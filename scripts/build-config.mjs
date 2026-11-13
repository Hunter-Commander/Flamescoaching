export function resolveBuildConfig({env={},args=[],sample,firebase}) {
  const production=args.includes('--production') || env.VERCEL_ENV==='production';
  const mode=env.FLAMES_DATA_MODE || (production?'firebase':'demo');
  if(!['demo','firebase'].includes(mode))throw new Error('FLAMES_DATA_MODE must be demo or firebase.');
  if(production&&mode!=='firebase')throw new Error('Production deployments cannot use sample data.');
  const config=structuredClone(mode==='firebase'?firebase:sample);
  if(mode==='firebase'){
    for(const key of ['apiKey','appId','authDomain','projectId'])if(!config.firebase?.[key])throw new Error(`Missing Firebase ${key}.`);
    if(config.firebase.projectId!=='flamescoaching-21cdf')throw new Error('Unexpected Firebase project. Expected flamescoaching-21cdf.');
    if(config.emulators)throw new Error('Hosted Firebase builds cannot use emulators.');
    config.appCheckSiteKey=(env.FLAMES_APPCHECK_SITE_KEY || config.appCheckSiteKey || '').trim();
    if(!/^[A-Za-z0-9_-]{20,200}$/.test(config.appCheckSiteKey)||/YOUR_|REPLACE|EXAMPLE|PLACEHOLDER/i.test(config.appCheckSiteKey))throw new Error('Set the public FLAMES_APPCHECK_SITE_KEY registered for this Firebase web app.');
  }
  return {config,mode,production};
}
