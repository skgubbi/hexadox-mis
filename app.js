const supabaseUrl="https://euyqvisqgxuwzcswwiqf.supabase.co";
const supabaseKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXAiLCJyZWYiOiJldXlxIn0";
const client=window.supabase.createClient(supabaseUrl,supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function getCurrentSession(){
  let lastError=null;
  for(let attempt=0;attempt<4;attempt++){
    const {data,error}=await client.auth.getSession();
    if(data&&data.session)return{session:data.session,user:data.session.user,error:null};
    lastError=error||new Error("No active session.");
    if(attempt<3)await sleep(400*(attempt+1));
  }
  return{session:null,user:null,error:lastError};
}
async function getCurrentUserProfile(){const {session,user,error:sessionError}=await getCurrentSession();if(sessionError||!session||!user)return{session:null,user:null,profile:null,error:sessionError||new Error("No active session.")};const {data:profile,error}=await client.from("user_profiles").select("id, full_name, role, active").eq("id",user.id).single();if(error||!profile)return{session,user,profile:null,error:error||new Error("User profile not found.")};if(profile.active!==true){await client.auth.signOut();return{session:null,user:null,profile:null,error:new Error("Your MIS account is inactive.")};}return{session,user,profile,error:null};}
async function requireLogin(redirectPage="index.html"){const result=await getCurrentUserProfile();if(result.error||!result.session||!result.profile){window.location.href=redirectPage;return null;}return result;}
async function requireAdmin(redirectPage="home.html"){const result=await requireLogin();if(!result)return null;if(result.profile.role!=="Admin"){alert("Access denied. Administrator permission is required.");window.location.href=redirectPage;return null;}return result;}

async function login(){const username=document.getElementById("username").value.trim(),password=document.getElementById("password").value,message=document.getElementById("message"),loginButton=document.getElementById("loginButton");message.innerHTML="";if(!username||!password){message.innerHTML="Please enter User ID and Password.";return;}loginButton.disabled=true;loginButton.innerHTML="LOGGING IN...";try{const email=username.includes("@")==true?username.toLowerCase():username.toLowerCase()+"@hexadox-mis.local";const {data,error}=await client.auth.signInWithPassword({email,password});if(error){message.innerHTML=error.message;return;}if(!data||!data.session){message.innerHTML="Login succeeded but no session was created.";return;}const profileResult=await getCurrentUserProfile();if(profileResult.error||!profileResult.profile){await client.auth.signOut();message.innerHTML=profileResult.error?.message||"MIS user profile could not be loaded.";return;}message.innerHTML="Login successful.";setTimeout(()=>window.location.href="home.html",300);}catch(error){console.error("LOGIN ERROR:",error);message.innerHTML=error.message||"Login failed.";}finally{loginButton.disabled=false;loginButton.innerHTML="LOGIN";}}
async function logout(){try{await client.auth.signOut();}catch(error){console.error("Logout error:",error);}window.location.href="index.html";}

// Product chart sorting: Secondary Unit Achievement % = Secondary Units / Target Units.
// Only the dashboard product chart is affected; all other charts remain unchanged.
if(window.Chart){
  const OriginalChart=window.Chart;
  window.Chart=new Proxy(OriginalChart,{construct(target,args){
    const ctx=args[0],config=args[1];
    if(ctx&&ctx.id==="productChart"&&config&&config.data&&Array.isArray(config.data.labels)&&Array.isArray(config.data.datasets)){
      const labels=config.data.labels;
      const targetDs=config.data.datasets.find(d=>/target/i.test(d.label||""));
      const secondaryDs=config.data.datasets.find(d=>/secondary/i.test(d.label||""));
      if(targetDs&&secondaryDs&&Array.isArray(targetDs.data)&&Array.isArray(secondaryDs.data)){
        const order=labels.map((_,i)=>i).sort((a,b)=>{
          const ta=Number(targetDs.data[a])||0,tb=Number(targetDs.data[b])||0;
          const sa=Number(secondaryDs.data[a])||0,sb=Number(secondaryDs.data[b])||0;
          const aa=ta>0?sa/ta:0,ab=tb>0?sb/tb:0;
          return aa-ab;
        });
        config.data.labels=order.map(i=>labels[i]);
        config.data.datasets.forEach(ds=>{if(Array.isArray(ds.data))ds.data=order.map(i=>ds.data[i]);});
      }
    }
    return Reflect.construct(target,args);
  }});
}
