const supabaseUrl="https://euyqvisqgxuwzcswwiqf.supabase.co";
const supabaseKey="sb_publishable_4YiBchy04wWSH4K74uXNiw_F0TUILqF";
const client=window.supabase.createClient(supabaseUrl,supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});

async function getCurrentSession(){for(let i=0;i<3;i++){const {data,error}=await client.auth.getSession();if(data?.session)return{session:data.session,user:data.session.user,error:null};if(error)return{session:null,user:null,error};if(i<2)await new Promise(r=>setTimeout(r,500));}return{session:null,user:null,error:new Error("No active session.")};}
async function getCurrentUserProfile(){const {session,user,error:sessionError}=await getCurrentSession();if(sessionError||!session||!user)return{session:null,user:null,profile:null,error:sessionError||new Error("No active session.")};const {data:profile,error}=await client.from("user_profiles").select("id, full_name, role, active").eq("id",user.id).single();if(error||!profile)return{session,user,profile:null,error:error||new Error("User profile not found.")};if(profile.active!==true){await client.auth.signOut();return{session:null,user:null,profile:null,error:new Error("Your MIS account is inactive.")};}return{session,user,profile,error:null};}
async function requireLogin(redirectPage="index.html"){const result=await getCurrentUserProfile();if(result.error||!result.session||!result.profile){window.location.href=redirectPage;return null;}return result;}
async function requireAdmin(redirectPage="home.html"){const result=await requireLogin();if(!result)return null;if(result.profile.role!=="Admin"){alert("Access denied. Administrator permission is required.");window.location.href=redirectPage;return null;}return result;}

async function login(){const username=document.getElementById("username").value.trim(),password=document.getElementById("password").value,message=document.getElementById("message"),loginButton=document.getElementById("loginButton");message.innerHTML="";if(!username||!password){message.innerHTML="Please enter User ID and Password.";return;}loginButton.disabled=true;loginButton.innerHTML="LOGGING IN...";try{const email=username.includes("@")==true?username.toLowerCase():username.toLowerCase()+"@hexadox-mis.local";const {data,error}=await client.auth.signInWithPassword({email,password});if(error){message.innerHTML=error.message;return;}if(!data||!data.session){message.innerHTML="Login succeeded but no session was created.";return;}const profileResult=await getCurrentUserProfile();if(profileResult.error||!profileResult.profile){await client.auth.signOut();message.innerHTML=profileResult.error?.message||"MIS user profile could not be loaded.";return;}message.innerHTML="Login successful.";setTimeout(()=>window.location.href="home.html",300);}catch(error){console.error("LOGIN ERROR:",error);message.innerHTML=error.message||"Login failed.";}finally{loginButton.disabled=false;loginButton.innerHTML="LOGIN";}}
async function logout(){try{await client.auth.signOut();}catch(error){console.error("Logout error:",error);}window.location.href="index.html";}

/* Edit Submitted Data: replace the inline save handler with a robust handler using explicit DOM references. */
if(location.pathname.endsWith("/edit-data.html")||location.pathname.endsWith("edit-data.html")){
 const editSaveButton=document.getElementById("saveButton");
 if(editSaveButton){
  editSaveButton.onclick=async function(){
   const msg=document.getElementById("message");
   editSaveButton.disabled=true;editSaveButton.textContent="SAVING...";
   try{
    const m=Number(document.getElementById("month")?.value),y=Number(document.getElementById("year")?.value),h=document.getElementById("hq")?.value,s=document.getElementById("stockist")?.value;
    if(!m||!y||!h||!s)throw new Error("Please select Month, Year, HQ and Stockist.");
    const {data:heads,error:he}=await client.from("sales_entry_header").select("id").eq("stockist_id",s).eq("hq_id",h).eq("month",m).eq("year",y).limit(1);
    if(he)throw he;if(!heads?.length)throw new Error("No submitted sales found for the selected entry.");
    const headerId=heads[0].id;
    const grouped={};
    document.querySelectorAll("[data-sales]").forEach(i=>{const id=i.dataset.sales;if(!grouped[id])grouped[id]={id};grouped[id][i.dataset.field]=i.value===""?null:(i.dataset.field==="pts"?parseFloat(i.value):parseInt(i.value,10));});
    const rows=Object.values(grouped);if(!rows.length)throw new Error("No sales rows found to save.");
    for(const u of rows){
     const{id,...payload}=u;const pts=Number(payload.pts)||0,pu=Number(payload.primary_units)||0,su=Number(payload.secondary_units)||0;
     payload.primary_value=Number((pts*pu).toFixed(2));payload.secondary_value=Number((pts*su).toFixed(2));
     const result=await client.from("sales_entry_details").update(payload).eq("id",id).eq("entry_id",headerId).select("id,pts,primary_units,primary_value,secondary_units,secondary_value");
     if(result.error)throw result.error;if(!result.data?.length)throw new Error("Database did not update product row "+id+". This usually indicates a Supabase update-policy issue.");
     const saved=result.data[0];if(payload.pts!==null&&Math.abs(Number(saved.pts)-Number(payload.pts))>0.000001)throw new Error("PTS was not retained for product row "+id+".");
    }
    if(typeof showMessage==="function")showMessage("Saved successfully. PTS, Primary Value and Secondary Value have been updated.","success");
    if(msg)msg.scrollIntoView({behavior:"smooth",block:"center"});
    if(typeof loadSales==="function")await loadSales();
   }catch(e){console.error("EDIT SALES SAVE ERROR:",e);if(typeof showMessage==="function")showMessage("Unable to save submitted sales: "+(e.message||e),"error");if(msg)msg.scrollIntoView({behavior:"smooth",block:"center"});}
   finally{editSaveButton.disabled=false;editSaveButton.textContent="SAVE CHANGES";}
  };
 }
}
