const supabaseUrl="https://euyqvisqgxuwzcswwiqf.supabase.co";
const supabaseKey="sb_publishable_4YiBchy04wWSH4K74uXNiw_F0TUILqF";
const client=window.supabase.createClient(supabaseUrl,supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});

async function getCurrentSession(){for(let i=0;i<3;i++){const {data,error}=await client.auth.getSession();if(data?.session)return{session:data.session,user:data.session.user,error:null};if(error)return{session:null,user:null,error};if(i<2)await new Promise(r=>setTimeout(r,500));}return{session:null,user:null,error:new Error("No active session.")};}
async function getCurrentUserProfile(){const {session,user,error:sessionError}=await getCurrentSession();if(sessionError||!session||!user)return{session:null,user:null,profile:null,error:sessionError||new Error("No active session.")};const {data:profile,error}=await client.from("user_profiles").select("id, full_name, role, active").eq("id",user.id).single();if(error||!profile)return{session,user,profile:null,error:error||new Error("User profile not found.")};if(profile.active!==true){await client.auth.signOut();return{session:null,user:null,profile:null,error:new Error("Your MIS account is inactive.")};}return{session,user,profile,error:null};}
async function requireLogin(redirectPage="index.html"){const result=await getCurrentUserProfile();if(result.error||!result.session||!result.profile){window.location.href=redirectPage;return null;}return result;}
async function requireAdmin(redirectPage="home.html"){const result=await requireLogin();if(!result)return null;if(result.profile.role!=="Admin"){alert("Access denied. Administrator permission is required.");window.location.href=redirectPage;return null;}return result;}

async function login(){const username=document.getElementById("username").value.trim(),password=document.getElementById("password").value,message=document.getElementById("message"),loginButton=document.getElementById("loginButton");message.innerHTML="";if(!username||!password){message.innerHTML="Please enter User ID and Password.";return;}loginButton.disabled=true;loginButton.innerHTML="LOGGING IN...";try{const email=username.includes("@")==true?username.toLowerCase():username.toLowerCase()+"@hexadox-mis.local";const {data,error}=await client.auth.signInWithPassword({email,password});if(error){message.innerHTML=error.message;return;}if(!data||!data.session){message.innerHTML="Login succeeded but no session was created.";return;}const profileResult=await getCurrentUserProfile();if(profileResult.error||!profileResult.profile){await client.auth.signOut();message.innerHTML=profileResult.error?.message||"MIS user profile could not be loaded.";return;}message.innerHTML="Login successful.";setTimeout(()=>window.location.href="home.html",300);}catch(error){console.error("LOGIN ERROR:",error);message.innerHTML=error.message||"Login failed.";}finally{loginButton.disabled=false;loginButton.innerHTML="LOGIN";}}
async function logout(){try{await client.auth.signOut();}catch(error){console.error("Logout error:",error);}window.location.href="index.html";}

/* Reports: use the Product Price Master for the selected transaction month.
   The submitted transaction PTS can contain an old/manual value; report values
   must use the month's master PTS so quantity x current monthly master PTS is
   consistent across Primary, Secondary and cumulative value reports. */
if(location.pathname.toLowerCase().endsWith("/reports.html")||location.pathname.toLowerCase().endsWith("reports.html")){
  window.addEventListener("DOMContentLoaded",()=>{
    if(typeof window.fetchDetails!=="function")return;
    const originalFetchDetails=window.fetchDetails;
    window.fetchDetails=async function(ids){
      const details=await originalFetchDetails(ids);
      if(!details.length)return details;
      const year=Number(document.getElementById("year")?.value)||new Date().getFullYear();
      const priceCols=["price_apr_2026","price_may_2026","price_jun_2026","price_jul_2026","price_aug_2026","price_sep_2026","price_oct_2026","price_nov_2026","price_dec_2026","price_jan_2027","price_feb_2027","price_mar_2027"];
      const productIds=[...new Set(details.map(d=>d.product_id).filter(Boolean))];
      if(!productIds.length)return details;
      const {data:products,error}=await client.from("products").select("id,"+priceCols.join(",")).in("id",productIds);
      if(error)throw error;
      const priceMap=new Map((products||[]).map(p=>[p.id,p]));
      const startMonth=Number(document.getElementById("startMonth")?.value)||4;
      const endMonth=Number(document.getElementById("endMonth")?.value)||startMonth;
      const selectedRange=startMonth===endMonth?startMonth:null;
      return details.map(d=>{
        const p=priceMap.get(d.product_id);
        if(!p)return d;
        const entryMonth=selectedRange||startMonth;
        const col=entryMonth<=9?priceCols[entryMonth-4]:priceCols[entryMonth-4];
        const masterPts=Number(p[col]);
        if(Number.isFinite(masterPts)&&masterPts>0)return {...d,pts:masterPts};
        return d;
      });
    };
  });
}
