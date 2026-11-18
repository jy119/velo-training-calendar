
import {createClient} from '@supabase/supabase-js';

/**
 * VELO account sync (v1): private athlete_state rows guarded by Supabase RLS.
 * This module cannot access privileged API keys or provider tokens.
 */
const config = window.__VELO_CLOUD_CONFIG__ || {};
if (config.url && config.publishableKey) startAccountSync();

async function startAccountSync() {
  const client = createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  let user = null;
  let ready = false;
  let revision = null;
  let saveTimer = null;
  let saving = false;
  let dirty = false;

  const header = document.querySelector('.top-right');
  if (!header || !window.veloCloudBridge) {
    console.warn('VELO account sync could not initialize the calendar bridge');
    return;
  }
  const button = document.createElement('button');
  button.className = 'button';
  button.type = 'button';
  button.textContent = 'Sign in';
  header.prepend(button);

  const account = document.createElement('div');
  account.className = 'velo-account-backdrop';
  account.style.display = 'none';
  account.innerHTML = `
    <div class="velo-account-panel" role="dialog" aria-modal="true" aria-label="VELO account">
      <button class="close" id="account-close" aria-label="Close">&times;</button>
      <div class="eyebrow">Your private training account</div>
      <h2>Take your calendar everywhere.</h2>
      <p class="smallnote">Your training data stays private to your account and synchronizes across devices.</p>
      <div id="account-content"></div>
      <p id="account-status" class="smallnote" role="status"></p>
    </div>`;
  document.body.appendChild(account);
  const content = account.querySelector('#account-content');
  const status = account.querySelector('#account-status');
  const setStatus = (message, error=false) => {
    status.textContent = message;
    status.style.color = error ? '#b9442d' : '';
  };
  const show = ()=>{account.style.display='flex'; drawAccount()};
  const hide = ()=>{account.style.display='none'};
  button.onclick = show;
  account.querySelector('#account-close').onclick = hide;
  account.onclick = e=>{if(e.target===account)hide()};

  function snapshot() {
    const data = window.veloCloudBridge.snapshot();
    if (!data || !data.workouts || !Number.isFinite(Number(data.ftp))) throw Error('Invalid local training state');
    return {schema:1,workouts:data.workouts,ftp:data.ftp,raceChoices:data.raceChoices||{},
      travelBlocks:data.travelBlocks||[],actualRides:data.actualRides||{}};
  }

  function renderButton() {
    button.textContent = user ? 'My account' : 'Sign in';
    button.title = user ? user.email || 'VELO athlete account' : 'Sync workouts to your account';
  }

  function drawAccount() {
    content.replaceChildren();
    if (!user) {
      const wrap=document.createElement('div');
      wrap.innerHTML = '<div class="field"><label for="velo-email">Email address</label><input id="velo-email" type="email" placeholder="you@example.com" autocomplete="email"/></div><button id="velo-login" class="button primary" type="button">Send secure sign-in link</button>';
      content.appendChild(wrap);
      wrap.querySelector('#velo-login').onclick=async()=>{
        const email=wrap.querySelector('#velo-email').value.trim();
        if(!/^\S+@\S+\.\S+$/.test(email))return setStatus('Enter a valid email address.',true);
        setStatus('Sending email sign-in link…');
        const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});
        if(error)return setStatus(error.message,true);
        setStatus('Check your email and open the sign-in link on this device.');
      };
      return;
    }
    const label=document.createElement('p');
    label.className='smallnote';
    label.textContent='Signed in as '+(user.email||'an athlete')+'.';
    content.appendChild(label);
    if (ready) {
      const synced=document.createElement('p');
      synced.className='callout';
      synced.textContent='Cloud sync is active. Changes to this calendar are saved to your private account.';
      content.appendChild(synced);
      const reload=document.createElement('button');
      reload.className='button';
      reload.textContent='Reload saved cloud plan';
      reload.onclick=async()=>{if(confirm('Replace local changes with the last saved cloud plan?'))await loadCloudPlan(true)};
      content.appendChild(reload);
    } else {
      const init=document.createElement('p');
      init.className='smallnote';
      init.textContent='Your cloud plan is not active yet. You can import your current browser plan or load a previously saved plan.';
      content.appendChild(init);
      const upload=document.createElement('button');
      upload.className='button primary';
      upload.textContent='Save this browser’s plan to my account';
      upload.onclick=()=>initializeCloudPlan();
      content.appendChild(upload);
      const load=document.createElement('button');
      load.className='button';
      load.textContent='Load my cloud plan';
      load.style.marginLeft='8px';
      load.onclick=()=>loadCloudPlan(true);
      content.appendChild(load);
    }
    const signout=document.createElement('button');
    signout.className='button';
    signout.textContent='Sign out';
    signout.style.display='block';
    signout.style.marginTop='20px';
    signout.onclick=async()=>{
      ready=false;revision=null;clearTimeout(saveTimer);
      await client.auth.signOut();
      setStatus('Signed out. Local data remains in this browser.');
    };
    content.appendChild(signout);
  }

  async function lookup() {
    const {data,error}=await client.from('athlete_state')
      .select('payload,revision').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    return data;
  }
  async function loadCloudPlan(explicit=false) {
    if(!user)return;
    setStatus('Loading your private plan…');
    try {
      const row=await lookup();
      if(!row) {setStatus('No cloud plan exists yet. Save your current browser plan to create one.');drawAccount();return;}
      if(!row.payload || row.payload.schema!==1)throw Error('Unsupported cloud plan format. No local data changed.');
      if(explicit && !confirm('This will replace the current browser plan with the saved cloud version. Continue?'))return;
      ready=false;
      window.veloCloudBridge.apply(row.payload);
      revision=row.revision;
      ready=true;
      dirty=false;
      setStatus('Cloud plan loaded. Future edits will sync automatically.');
      drawAccount();
    }catch(e){setStatus('Could not load cloud plan: '+e.message,true);}
  }
  async function initializeCloudPlan() {
    if(!user)return;
    setStatus('Checking your account…');
    try {
      const existing=await lookup();
      if(existing) {
        setStatus('A cloud plan already exists. Use “Load my cloud plan” instead, to avoid overwriting it.',true);
        return;
      }
      if(!confirm('Save this browser’s workouts, race choices, travel, and activity summaries to your account?'))return;
      const payload=snapshot();
      const {data,error}=await client.from('athlete_state')
        .insert({user_id:user.id,payload,revision:1})
        .select('revision').single();
      if(error)throw error;
      revision=data.revision;ready=true;dirty=false;
      setStatus('Saved! Cloud syncing is now active.');
      drawAccount();
    }catch(e){setStatus('Cloud setup failed: '+e.message,true);}
  }
  async function saveCloud() {
    if(!ready||!user||saving)return;
    saving=true;dirty=false;
    try {
      const payload=snapshot();
      if(JSON.stringify(payload).length>1000000)throw Error('Training data exceeds the 1 MB plan limit');
      const {data,error}=await client.from('athlete_state')
        .update({payload,revision:revision+1,updated_at:new Date().toISOString()})
        .eq('user_id',user.id).eq('revision',revision)
        .select('revision').maybeSingle();
      if(error)throw error;
      if(!data){ready=false;setStatus('Cloud version changed in another browser. Reload before saving to avoid overwriting new changes.',true);button.textContent='Sync conflict';return;}
      revision=data.revision;
      button.textContent='My account ✓';
    } catch(e) {
      dirty=true;setStatus('Could not sync: '+e.message,true);
      button.textContent='Sync error';
    } finally {
      saving=false;
      if(dirty&&ready){dirty=false;clearTimeout(saveTimer);saveTimer=setTimeout(saveCloud,900);}
    }
  }
  window.addEventListener('velo-data-changed',()=>{
    if(!ready)return;
    dirty=true;
    clearTimeout(saveTimer);
    saveTimer=setTimeout(saveCloud,650);
  });

  async function handleSession(session) {
    const next=session?.user||null;
    if(next?.id===user?.id)return;
    user=next;
    ready=false;revision=null;
    clearTimeout(saveTimer);
    renderButton();drawAccount();
    if(!user)return;
    try {
      const existing=await lookup();
      if(existing) {
        setStatus('Cloud plan found. Loading it into this browser.');
        await loadCloudPlan(false);
      } else setStatus('First sign-in: select “Save this browser’s plan to my account” to preserve your existing calendar.');
    }catch(e){setStatus('Could not contact your cloud database: '+e.message,true);}
  }
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='SIGNED_OUT')
      setTimeout(()=>handleSession(session),0);
  });
}
