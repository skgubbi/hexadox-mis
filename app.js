const supabaseUrl="https://euyqvisqgxuwzcswwiqf.supabase.co";
const supabaseKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1eXF2aXNxZ3h1d3pjc3d3aXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NDY3OTIsImV4cCI6MjEwMjQyMjc5Mn0.9QjLUxFdiy-D92hImFtLuPcLQ81b47YK9PgyfwgjELc";
const client=window.supabase.createClient(supabaseUrl,supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});

async function getCurrentSession(){const {data,error}=await client.auth.getSession();if(error||!data.session)return{session:null,user:null,error:error||new Error("No active session.")};return{session:data.session,user:data.session.user,error:null};}
async function getCurrentUserProfile(){const {session,user,error:sessionError}=await getCurrentSession();if(sessionError||!session||!user)return{session:null,user:null,profile:null,error:sessionError||new Error("No active session.")};const {data:profile,error}=await client.from("user_profiles").select("id, full_name, role, active").eq("id",user.id).single();if(error||!profile)return{session,user,profile:null,error:error||new Error("User profile not found.")};if(profile.active!==true){await client.auth.signOut();return{session:null,user:null,profile:null,error:new Error("Your MIS account is inactive.")};}return{session,user,profile,error:null};}
async function requireLogin(redirectPage="index.html"){const result=await getCurrentUserProfile();if(result.error||!result.session||!result.profile){window.location.href=redirectPage;return null;}return result;}
async function requireAdmin(redirectPage="home.html"){const result=await requireLogin();if(!result)return null;if(result.profile.role!=="Admin"){alert("Access denied. Administrator permission is required.");window.location.href=redirectPage;return null;}return result;}

async function login(){const username=document.getElementById("username").value.trim(),password=document.getElementById("password").value,message=document.getElementById("message"),loginButton=document.getElementById("loginButton");message.innerHTML="";if(!username||!password){message.innerHTML="Please enter User ID and Password.";return;}loginButton.disabled=true;loginButton.innerHTML="LOGGING IN...";try{const email=username.includes("@")==true?username.toLowerCase():username.toLowerCase()+"@hexadox-mis.local";const {data,error}=await client.auth.signInWithPassword({email,password});if(error){message.innerHTML=error.message;return;}if(!data||!data.session){message.innerHTML="Login succeeded but no session was created.";return;}const profileResult=await getCurrentUserProfile();if(profileResult.error||!profileResult.profile){await client.auth.signOut();message.innerHTML=profileResult.error?.message||"MIS user profile could not be loaded.";return;}message.innerHTML="Login successful.";setTimeout(()=>window.location.href="home.html",300);}catch(error){console.error("LOGIN ERROR:",error);message.innerHTML=error.message||"Login failed.";}finally{loginButton.disabled=false;loginButton.innerHTML="LOGIN";}}
async function logout(){try{await client.auth.signOut();}catch(error){console.error("Logout error:",error);}window.location.href="index.html";}

// ==================================================
// REPORTS: HQ-WISE PRODUCT-WISE ACHIEVEMENT %
// ==================================================
(function setupHQProductAchievementReport(){
    const install=()=>{
        const target=document.getElementById("achievementReport");
        if(!target||target.dataset.hqProductAchievementInstalled==="1")return;
        target.dataset.hqProductAchievementInstalled="1";
        const render=async()=>{
            const yearEl=document.getElementById("year"),monthEl=document.getElementById("month"),hqEl=document.getElementById("hq"),productEl=document.getElementById("product");
            if(!yearEl||!monthEl||!hqEl||!productEl)return;
            const year=parseInt(yearEl.value,10),month=monthEl.value,hqId=hqEl.value,productId=productEl.value;
            if(!year)return;
            target.innerHTML='<div class="loading">Loading HQ-wise Product-wise achievement...</div>';
            try{
                const profile=await getCurrentUserProfile();
                if(profile.error||!profile.profile){window.location.href="index.html";return;}
                let allowedHQIds=[];
                if(profile.profile.role!=="Admin"&&profile.profile.role!=="ABM"){
                    const {data:mappings,error:me}=await client.from("user_hq_mapping").select("hq_id").eq("user_id",profile.profile.id);
                    if(me)throw me;allowedHQIds=(mappings||[]).map(x=>x.hq_id).filter(Boolean);
                }
                let tq=client.from("targets").select("hq_id,month,year,product_id,target_pts,target_units").eq("year",year);
                if(month)tq=tq.eq("month",month);if(hqId)tq=tq.eq("hq_id",hqId);if(productId)tq=tq.eq("product_id",productId);if(allowedHQIds.length)tq=tq.in("hq_id",allowedHQIds);
                const {data:targets,error:te}=await tq;if(te)throw te;
                let hqQuery=client.from("sales_entry_header").select("id,hq_id,month,year").eq("year",year);
                if(month)hqQuery=hqQuery.eq("month",month);if(hqId)hqQuery=hqQuery.eq("hq_id",hqId);if(allowedHQIds.length)hqQuery=hqQuery.in("hq_id",allowedHQIds);
                const {data:headers,error:he}=await hqQuery;if(he)throw he;
                const ids=(headers||[]).map(x=>x.id);let details=[];
                for(let i=0;i<ids.length;i+=50){const {data,error}=await client.from("sales_entry_details").select("entry_id,product_id,primary_value,secondary_value").in("entry_id",ids.slice(i,i+50));if(error)throw error;details.push(...(data||[]));}
                const {data:hqs,error:hqe}=await client.from("hqs").select("id,hq_name");if(hqe)throw hqe;
                const {data:products,error:pe}=await client.from("products").select("id,product_name");if(pe)throw pe;
                const hqMap=new Map((hqs||[]).map(x=>[x.id,x.hq_name])),productMap=new Map((products||[]).map(x=>[x.id,x.product_name])),headerMap=new Map((headers||[]).map(x=>[x.id,x]));
                const groups=new Map();
                const ensure=(hq,p)=>{const key=String(hq)+"|"+String(p);if(!groups.has(key))groups.set(key,{hqId:hq,productId:p,targetValue:0,primaryValue:0,secondaryValue:0});return groups.get(key);};
                (targets||[]).forEach(t=>{const g=ensure(t.hq_id,t.product_id);g.targetValue+=(Number(t.target_units)||0)*(Number(t.target_pts)||0);});
                details.forEach(d=>{if(productId&&d.product_id!==productId)return;const h=headerMap.get(d.entry_id);if(!h)return;const g=ensure(h.hq_id,d.product_id);g.primaryValue+=Number(d.primary_value)||0;g.secondaryValue+=Number(d.secondary_value)||0;});
                const rows=[...groups.values()].sort((a,b)=>String(hqMap.get(a.hqId)||"").localeCompare(String(hqMap.get(b.hqId)||""))||String(productMap.get(a.productId)||"").localeCompare(String(productMap.get(b.productId)||"")));
                if(!rows.length){target.innerHTML='<div class="empty">No target or achievement data found for the selected filters.</div>';return;}
                const pct=(a,t)=>t>0?(a/t*100):0,fmt=v=>Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";
                let totalTarget=0,totalPrimary=0,totalSecondary=0;
                let html='<div class="table-container"><table><thead><tr><th>HQ</th><th>Product Name</th><th>Primary Achievement</th><th>Secondary Achievement</th></tr></thead><tbody>';
                rows.forEach(r=>{totalTarget+=r.targetValue;totalPrimary+=r.primaryValue;totalSecondary+=r.secondaryValue;html+='<tr><td class="left">'+escapeHTML(hqMap.get(r.hqId)||"Unknown HQ")+'</td><td class="left">'+escapeHTML(productMap.get(r.productId)||"Unknown Product")+'</td><td class="percent">'+fmt(pct(r.primaryValue,r.targetValue))+'</td><td class="percent">'+fmt(pct(r.secondaryValue,r.targetValue))+'</td></tr>';});
                html+='<tr class="achievement-total"><td colspan="2" class="left">'+(hqId?"TOTAL":"ABM TOTAL")+'</td><td class="percent">'+fmt(pct(totalPrimary,totalTarget))+'</td><td class="percent">'+fmt(pct(totalSecondary,totalTarget))+'</td></tr></tbody></table></div>';
                target.innerHTML=html;
            }catch(e){console.error("HQ PRODUCT ACHIEVEMENT ERROR",e);target.innerHTML='<div class="empty">Unable to generate HQ-wise Product-wise achievement report.</div>';}
        };
        const escapeHTML=text=>{const d=document.createElement("div");d.textContent=text??"";return d.innerHTML;};
        const observer=new MutationObserver(()=>{if(target.dataset.renderingHQProduct==="1")return;if(target.querySelector("table")){target.dataset.renderingHQProduct="1";render().finally(()=>{target.dataset.renderingHQProduct="0";});}});
        observer.observe(target,{childList:true,subtree:true});
    };
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
})();