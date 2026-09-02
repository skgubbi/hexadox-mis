const supabaseUrl="https://euyqvisqgxuwzcswwiqf.supabase.co";
const supabaseKey="sb_publishable_4YiBchy04wWSH4K74uXNiw_F0TUILqF";
const client=window.supabase.createClient(supabaseUrl,supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});

async function getCurrentSession(){for(let i=0;i<3;i++){const {data,error}=await client.auth.getSession();if(data?.session)return{session:data.session,user:data.session.user,error:null};if(error)return{session:null,user:null,error};if(i<2)await new Promise(r=>setTimeout(r,500));}return{session:null,user:null,error:new Error("No active session.")};}
async function getCurrentUserProfile(){const {session,user,error:sessionError}=await getCurrentSession();if(sessionError||!session||!user)return{session:null,user:null,profile:null,error:sessionError||new Error("No active session.")};const {data:profile,error}=await client.from("user_profiles").select("id, full_name, role, active").eq("id",user.id).single();if(error||!profile)return{session,user,profile:null,error:error||new Error("User profile not found.")};if(profile.active!==true){await client.auth.signOut();return{session:null,user:null,profile:null,error:new Error("Your MIS account is inactive.")};}return{session,user,profile,error:null};}
async function requireLogin(redirectPage="index.html"){const result=await getCurrentUserProfile();if(result.error||!result.session||!result.profile){window.location.href=redirectPage;return null;}return result;}
async function requireAdmin(redirectPage="home.html"){const result=await requireLogin();if(!result)return null;if(result.profile.role!=="Admin"){alert("Access denied. Administrator permission is required.");window.location.href=redirectPage;return null;}return result;}

async function login(){const username=document.getElementById("username").value.trim(),password=document.getElementById("password").value,message=document.getElementById("message"),loginButton=document.getElementById("loginButton");message.innerHTML="";if(!username||!password){message.innerHTML="Please enter User ID and Password.";return;}loginButton.disabled=true;loginButton.innerHTML="LOGGING IN...";try{const email=username.includes("@")==true?username.toLowerCase():username.toLowerCase()+"@hexadox-mis.local";const {data,error}=await client.auth.signInWithPassword({email,password});if(error){message.innerHTML=error.message;return;}if(!data||!data.session){message.innerHTML="Login succeeded but no session was created.";return;}const profileResult=await getCurrentUserProfile();if(profileResult.error||!profileResult.profile){await client.auth.signOut();message.innerHTML=profileResult.error?.message||"MIS user profile could not be loaded.";return;}message.innerHTML="Login successful.";setTimeout(()=>window.location.href="home.html",300);}catch(error){console.error("LOGIN ERROR:",error);message.innerHTML=error.message||"Login failed.";}finally{loginButton.disabled=false;loginButton.innerHTML="LOGIN";}}
async function logout(){try{await client.auth.signOut();}catch(error){console.error("Logout error:",error);}window.location.href="index.html";}

/* Reports PDF export */
(function(){
function setupPDFButton(){
if(!/reports\.html$/i.test(location.pathname)||document.getElementById("downloadPdfButton"))return;
const actions=document.querySelector(".actions");if(!actions)return;
const btn=document.createElement("button");btn.id="downloadPdfButton";btn.className="report-button";btn.type="button";btn.textContent="DOWNLOAD PDF";btn.style.marginLeft="10px";btn.style.background="#252525";btn.addEventListener("click",downloadReportsPDF);actions.appendChild(btn);
}
function loadPDFLibrary(){return new Promise((resolve,reject)=>{if(window.html2pdf)return resolve();const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";s.onload=resolve;s.onerror=()=>reject(new Error("Unable to load PDF generator. Check your internet connection."));document.head.appendChild(s);});}
async function downloadReportsPDF(){
const btn=document.getElementById("downloadPdfButton");
const hasData=["salesReport","achievementSalesReport","cumulativeAchievementReport"].some(id=>document.getElementById(id)?.querySelector("table"));
if(!hasData){alert("Please click GENERATE REPORT first.");return;}
try{
btn.disabled=true;btn.textContent="CREATING PDF...";await loadPDFLibrary();
const source=document.querySelector(".container");const clone=source.cloneNode(true);
clone.querySelectorAll(".actions,.message").forEach(x=>x.remove());clone.style.width="100%";clone.style.maxWidth="none";clone.style.padding="0";clone.style.margin="0";clone.style.background="#fff";
clone.querySelectorAll(".card").forEach(x=>{x.style.boxShadow="none";x.style.border="0";x.style.pageBreakInside="avoid";x.style.breakInside="avoid";});
clone.querySelectorAll("table").forEach(t=>{t.style.fontSize="9px";t.style.minWidth="0";t.style.width="100%";});clone.querySelectorAll("tr").forEach(r=>{r.style.pageBreakInside="avoid";r.style.breakInside="avoid";});
const title=document.createElement("div");title.innerHTML='<h1 style="margin:0 0 5px;text-align:center;font-size:20px">HEXADOX MIS</h1><div style="text-align:center;font-size:14px;font-weight:bold;margin-bottom:8px">SALES REPORT</div>';
const year=document.getElementById("year")?.value||"";const sm=document.getElementById("startMonth")?.selectedOptions[0]?.text||"";const em=document.getElementById("endMonth")?.selectedOptions[0]?.text||"";const hq=document.getElementById("hq")?.selectedOptions[0]?.text||"All HQs";const product=document.getElementById("product")?.selectedOptions[0]?.text||"All Products";
const meta=document.createElement("div");meta.style.cssText="font-size:10px;text-align:center;color:#555;margin-bottom:14px";meta.textContent=`Period: ${sm} ${year} → ${em} ${year} | HQ: ${hq} | Product: ${product}`;title.appendChild(meta);clone.insertBefore(title,clone.firstChild);
await window.html2pdf().set({margin:[8,8,10,8],filename:`Hexadox_MIS_Sales_Report_${year}.pdf`,image:{type:"jpeg",quality:.96},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff"},jsPDF:{unit:"mm",format:"a4",orientation:"landscape"},pagebreak:{mode:["css","legacy"]}}).from(clone).save();
}catch(e){console.error("PDF ERROR:",e);alert(e.message||"Unable to create PDF.");}finally{btn.disabled=false;btn.textContent="DOWNLOAD PDF";}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setupPDFButton);else setupPDFButton();
})();
