const supabaseUrl="https://euyqvisqgxuwzcswwiqf.supabase.co";
const supabaseKey="sb_publishable_4YiBchy04wWSH4K74uXNiw_F0TUILqF";
const client=window.supabase.createClient(supabaseUrl,supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});

async function getCurrentSession(){for(let i=0;i<3;i++){const {data,error}=await client.auth.getSession();if(data?.session)return{session:data.session,user:data.session.user,error:null};if(error)return{session:null,user:null,error};if(i<2)await new Promise(r=>setTimeout(r,500));}return{session:null,user:null,error:new Error("No active session.")};}
async function getCurrentUserProfile(){const {session,user,error:sessionError}=await getCurrentSession();if(sessionError||!session||!user)return{session:null,user:null,profile:null,error:sessionError||new Error("No active session.")};const {data:profile,error}=await client.from("user_profiles").select("id, full_name, role, active").eq("id",user.id).single();if(error||!profile)return{session,user,profile:null,error:error||new Error("User profile not found.")};if(profile.active!==true){await client.auth.signOut();return{session:null,user:null,profile:null,error:new Error("Your MIS account is inactive.")};}return{session,user,profile,error:null};}
async function requireLogin(redirectPage="index.html"){const result=await getCurrentUserProfile();if(result.error||!result.session||!result.profile){window.location.href=redirectPage;return null;}return result;}
async function requireAdmin(redirectPage="home.html"){const result=await requireLogin();if(!result)return null;if(result.profile.role!=="Admin"){alert("Access denied. Administrator permission is required.");window.location.href=redirectPage;return null;}return result;}

async function login(){const username=document.getElementById("username").value.trim(),password=document.getElementById("password").value,message=document.getElementById("message"),loginButton=document.getElementById("loginButton");message.innerHTML="";if(!username||!password){message.innerHTML="Please enter User ID and Password.";return;}loginButton.disabled=true;loginButton.innerHTML="LOGGING IN...";try{const email=username.includes("@")==true?username.toLowerCase():username.toLowerCase()+"@hexadox-mis.local";const {data,error}=await client.auth.signInWithPassword({email,password});if(error){message.innerHTML=error.message;return;}if(!data||!data.session){message.innerHTML="Login succeeded but no session was created.";return;}const profileResult=await getCurrentUserProfile();if(profileResult.error||!profileResult.profile){await client.auth.signOut();message.innerHTML=profileResult.error?.message||"MIS user profile could not be loaded.";return;}message.innerHTML="Login successful.";setTimeout(()=>window.location.href="home.html",300);}catch(error){console.error("LOGIN ERROR:",error);message.innerHTML=error.message||"Login failed.";}finally{loginButton.disabled=false;loginButton.innerHTML="LOGIN";}}
async function logout(){try{await client.auth.signOut();}catch(error){console.error("Logout error:",error);}window.location.href="index.html";}

/* Reports: report values use the Product Price Master PTS for the actual transaction month, rather than a stale/manual PTS saved on the transaction. */
if(location.pathname.toLowerCase().endsWith("/reports.html")||location.pathname.toLowerCase().endsWith("reports.html")){
  window.addEventListener("DOMContentLoaded",()=>{
    if(typeof window.fetchDetails!=="function")return;
    const originalFetchDetails=window.fetchDetails;
    window.fetchDetails=async function(ids){
      const details=await originalFetchDetails(ids);
      if(!details.length)return details;
      const priceCols=["price_apr_2026","price_may_2026","price_jun_2026","price_jul_2026","price_aug_2026","price_sep_2026","price_oct_2026","price_nov_2026","price_dec_2026","price_jan_2027","price_feb_2027","price_mar_2027"];
      const productIds=[...new Set(details.map(d=>d.product_id).filter(Boolean))];
      const entryIds=[...new Set(details.map(d=>d.entry_id).filter(Boolean))];
      if(!productIds.length||!entryIds.length)return details;
      const [{data:products,error:pe},{data:headers,error:he}]=await Promise.all([
        client.from("products").select("id,"+priceCols.join(",")).in("id",productIds),
        client.from("sales_entry_header").select("id,month,year").in("id",entryIds)
      ]);
      if(pe)throw pe;if(he)throw he;
      const priceMap=new Map((products||[]).map(p=>[p.id,p]));
      const headerMap=new Map((headers||[]).map(h=>[h.id,h]));
      return details.map(d=>{
        const p=priceMap.get(d.product_id),h=headerMap.get(d.entry_id);
        if(!p||!h)return d;
        const month=Number(h.month),year=Number(h.year);
        let col=null;
        if(year===2026&&month>=4&&month<=12)col=priceCols[month-4];
        else if(year===2027&&month>=1&&month<=3)col=priceCols[9+(month-1)];
        if(!col)return d;
        const masterPts=Number(p[col]);
        return Number.isFinite(masterPts)&&masterPts>0?{...d,pts:masterPts}:d;
      });
    };
  });
  window.addEventListener("DOMContentLoaded",()=>{
    if(typeof window.downloadReportsPDF!=="function")return;
    window.downloadReportsPDF=async function(){
      const btn=document.getElementById("downloadPdfButton");
      const hasData=["salesReport","achievementSalesReport","cumulativeAchievementReport"].some(id=>document.getElementById(id)?.querySelector("table"));
      if(!hasData){alert("Please click GENERATE REPORT first.");return}
      try{
        btn.disabled=true;btn.textContent="CREATING PDF...";
        const source=document.querySelector(".container");
        const clone=source.cloneNode(true);
        const filterCard=clone.querySelector(".card:first-child");
        if(filterCard)filterCard.remove();
        clone.querySelectorAll(".actions,.message").forEach(x=>x.remove());
        clone.style.width="100%";clone.style.maxWidth="none";clone.style.padding="0";clone.style.margin="0";clone.style.background="#fff";
        const cards=[...clone.querySelectorAll(".card")];
        cards.forEach((x,i)=>{x.style.boxShadow="none";x.style.border="0";x.style.pageBreakInside="auto";x.style.breakInside="auto";if(i>0){x.style.pageBreakBefore="always";x.style.breakBefore="page";}});
        clone.querySelectorAll("table").forEach(t=>{t.style.fontSize="9px";t.style.minWidth="0";t.style.width="100%";t.style.pageBreakInside="auto";t.style.breakInside="auto"});
        clone.querySelectorAll("tr").forEach(r=>{r.style.pageBreakInside="avoid";r.style.breakInside="avoid"});
        const title=document.createElement("div");
        title.innerHTML='<h1 style="margin:0 0 5px;text-align:center;font-size:20px">HEXADOX MIS</h1><div style="text-align:center;font-size:14px;font-weight:bold;margin-bottom:8px">SALES REPORT</div>';
        const year=document.getElementById("year")?.value||"";const sm=document.getElementById("startMonth")?.selectedOptions[0]?.text||"";const em=document.getElementById("endMonth")?.selectedOptions[0]?.text||"";const hq=document.getElementById("hq")?.selectedOptions[0]?.text||"All HQs";const product=document.getElementById("product")?.selectedOptions[0]?.text||"All Products";
        const meta=document.createElement("div");meta.style.cssText="font-size:10px;text-align:center;color:#555;margin-bottom:14px";meta.textContent=`Period: ${sm} ${year} → ${em} ${year} | HQ: ${hq} | Product: ${product}`;title.appendChild(meta);clone.insertBefore(title,clone.firstChild);
        await window.html2pdf().set({margin:[8,8,10,8],filename:`Hexadox_MIS_Sales_Report_${year}.pdf`,image:{type:"jpeg",quality:.96},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff"},jsPDF:{unit:"mm",format:"a4",orientation:"landscape"},pagebreak:{mode:["css","legacy"]}}).from(clone).save();
      }catch(e){console.error("PDF ERROR:",e);alert(e.message||"Unable to create PDF.")}finally{btn.disabled=false;btn.textContent="DOWNLOAD PDF"}
    };
  });
}

/* Safe Primary / Secondary display and editing. Authentication above is untouched. */
window.addEventListener("DOMContentLoaded",()=>{
  const path=location.pathname.toLowerCase();
  if(path.endsWith("submitted-data.html")){
    if(typeof window.searchSales!=="function")return;
    window.searchSales=async function(){
      const m=+document.getElementById("month").value,y=+document.getElementById("year").value,h=document.getElementById("hq").value,s=document.getElementById("stockist").value;
      if(!m||!y||!h||h==='ALL'||!s){if(typeof showError==='function')showError("Please select Month, Year, HQ and Stockist.");return}
      const area=document.getElementById("result");area.className="loading";area.textContent="Searching...";
      try{
        const{data:heads,error:he}=await client.from("sales_entry_header").select("id").eq("stockist_id",s).eq("hq_id",h).eq("month",m).eq("year",y).limit(1);if(he)throw he;if(!heads?.length){area.textContent="No submitted data found.";return}
        const{data:details,error:de}=await client.from("sales_entry_details").select("product_id,pts,primary_pts,secondary_pts,primary_units,secondary_units,primary_value,secondary_value").eq("entry_id",heads[0].id);if(de)throw de;
        const ids=[...new Set((details||[]).map(x=>x.product_id).filter(Boolean))];const{data:products,error:pe}=await client.from("products").select("id,product_name").in("id",ids);if(pe)throw pe;const map={};(products||[]).forEach(p=>map[p.id]=p.product_name);
        let pv=0,sv=0,html='<h3>Submitted Sales</h3><p><b>'+months[m]+' '+y+'</b></p><div class="table-wrap"><table><thead><tr><th>Product</th><th>Primary PTS</th><th>Primary Qty</th><th>Primary Value</th><th>Secondary PTS</th><th>Secondary Qty</th><th>Secondary Value</th></tr></thead><tbody>';
        [...(details||[])].sort((a,b)=>(map[a.product_id]||'').localeCompare(map[b.product_id]||'')).forEach(d=>{const pp=Number(d.primary_pts??d.pts)||0,sp=Number(d.secondary_pts??d.pts)||0,p=pp*(Number(d.primary_units)||0),sv2=sp*(Number(d.secondary_units)||0);pv+=p;sv+=sv2;html+='<tr><td>'+esc(map[d.product_id]||'Unknown')+'</td><td>'+pp.toFixed(2)+'</td><td>'+num(d.primary_units)+'</td><td>'+money(p)+'</td><td>'+sp.toFixed(2)+'</td><td>'+num(d.secondary_units)+'</td><td>'+money(sv2)+'</td></tr>'});
        html+='<tr class="total"><td colspan="3">TOTAL</td><td>'+money(pv)+'</td><td></td><td></td><td>'+money(sv)+'</td></tr></tbody></table></div>';area.className="";area.innerHTML=html;
      }catch(e){if(typeof showError==='function')showError(e.message);else area.textContent=e.message}
    };
  }
  if(path.endsWith("edit-data.html")){
    if(typeof window.loadSales!=="function")return;
    window.loadSales=async function(){
      const m=+document.getElementById("month").value,y=+document.getElementById("year").value,h=document.getElementById("hq").value,s=document.getElementById("stockist").value;if(!m||!y||!h||!s){showMessage("Please select Month, Year, HQ and Stockist.","error");return}
      setLoading(true,"Loading submitted sales...");
      try{
        const{data:heads,error:he}=await client.from("sales_entry_header").select("id,stockist_id,hq_id,month,year").eq("stockist_id",s).eq("hq_id",h).eq("month",m).eq("year",y).limit(1);if(he)throw he;if(!heads?.length)throw new Error("No submitted sales found for this Month, Year, HQ and Stockist.");currentHeader=heads[0];
        const{data:rows,error:de}=await client.from("sales_entry_details").select("id,product_id,pts,primary_pts,secondary_pts,primary_units,secondary_units,products(product_name)").eq("entry_id",currentHeader.id).order("id");if(de)throw de;salesDetails=(rows||[]).filter(r=>(Number(r.primary_units)||0)!==0||(Number(r.secondary_units)||0)!==0||(Number(r.primary_pts??r.pts)||0)!==0);
        const{data:prods,error:pe}=await client.from("products").select("id,product_name").eq("active",true).order("product_name");if(pe)throw pe;activeProducts=prods||[];renderSplitSales();saveArea.classList.remove("hidden");
      }catch(e){productArea.innerHTML='<div class="message error" style="display:block">'+escapeHTML(e.message)+'</div>'}finally{setLoading(false)}
    };
    window.renderSplitSales=function(){
      let html='<div class="info">Primary and Secondary PTS are independent. Values are calculated from the corresponding PTS and units.</div><div class="add-product-bar"><select id="addProductSelect"><option value="">Select brand/product to add</option>';
      const used=new Set(salesDetails.map(r=>String(r.product_id)));activeProducts.filter(p=>!used.has(String(p.id))).forEach(p=>html+='<option value="'+p.id+'">'+escapeHTML(p.product_name)+'</option>');
      html+='</select><button class="btn" type="button" onclick="addSplitProduct()">+ ADD BRAND</button></div><div class="table-container"><table><thead><tr><th>#</th><th>Product</th><th>Primary PTS</th><th>Primary Units</th><th>Primary Value</th><th>Secondary PTS</th><th>Secondary Units</th><th>Secondary Value</th><th>Action</th></tr></thead><tbody>';
      salesDetails.forEach((r,i)=>{const id=r.id||('new_'+r.product_id),pp=Number(r.primary_pts??r.pts)||0,sp=Number(r.secondary_pts??r.pts)||0;html+='<tr data-split-id="'+id+'" data-product-id="'+r.product_id+'"><td>'+(i+1)+'</td><td class="product">'+escapeHTML(r.products?.product_name||r.product_name||'')+'</td><td><input type="number" min="0" step="0.01" data-field="primary_pts" value="'+pp+'"></td><td><input type="number" step="1" data-field="primary_units" value="'+(r.primary_units??0)+'"></td><td class="value split-pv">'+formatValue(pp*(Number(r.primary_units)||0))+'</td><td><input type="number" min="0" step="0.01" data-field="secondary_pts" value="'+sp+'"></td><td><input type="number" step="1" data-field="secondary_units" value="'+(r.secondary_units??0)+'"></td><td class="value split-sv">'+formatValue(sp*(Number(r.secondary_units)||0))+'</td><td><button class="remove-btn" type="button" onclick="removeSplitProduct(\''+id+'\')">REMOVE</button></td></tr>'});
      html+='</tbody></table></div>';productArea.innerHTML=html;attachSplitCalculation();
    };
    window.attachSplitCalculation=function(){document.querySelectorAll('#productArea tr[data-split-id]').forEach(row=>{row.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>{const pp=Number(row.querySelector('[data-field="primary_pts"]').value)||0,pu=Number(row.querySelector('[data-field="primary_units"]').value)||0,sp=Number(row.querySelector('[data-field="secondary_pts"]').value)||0,su=Number(row.querySelector('[data-field="secondary_units"]').value)||0;row.querySelector('.split-pv').textContent=formatValue(pp*pu);row.querySelector('.split-sv').textContent=formatValue(sp*su);inp.classList.add('changed')}))})};
    window.addSplitProduct=function(){const sel=document.getElementById('addProductSelect'),p=activeProducts.find(x=>String(x.id)===String(sel?.value));if(!p){showMessage('Please select a brand/product to add.','error');return}if(salesDetails.some(r=>String(r.product_id)===String(p.id))){showMessage('That brand/product is already in this entry.','error');return}salesDetails.push({id:null,product_id:p.id,primary_pts:0,secondary_pts:0,primary_units:0,secondary_units:0,products:{product_name:p.product_name}});renderSplitSales()};
    window.removeSplitProduct=function(id){if(!confirm('Remove this product from the submitted entry?'))return;salesDetails=salesDetails.filter(r=>String(r.id||('new_'+r.product_id))!==String(id));renderSplitSales()};
    window.saveSales=async function(){if(!currentHeader)return;const b=document.getElementById('saveButton');b.disabled=true;b.textContent='SAVING...';try{const desired=[];document.querySelectorAll('#productArea tr[data-product-id]').forEach(tr=>{const id=tr.dataset.splitId,productId=tr.dataset.productId;const pp=Number(tr.querySelector('[data-field="primary_pts"]').value)||0,sp=Number(tr.querySelector('[data-field="secondary_pts"]').value)||0,pu=Number(tr.querySelector('[data-field="primary_units"]').value)||0,su=Number(tr.querySelector('[data-field="secondary_units"]').value)||0;if(pp<0||sp<0||!Number.isInteger(pu)||!Number.isInteger(su))throw new Error('Invalid PTS or units for '+(tr.querySelector('.product')?.textContent||'product'));desired.push({id:id.startsWith('new_')?null:id,product_id:productId,primary_pts:pp,secondary_pts:sp,primary_units:pu,secondary_units:su,primary_value:pp*pu,secondary_value:sp*su,pts:pp})});const keep=new Set();for(const r of desired){if(r.id){keep.add(String(r.id));const{error}=await client.from('sales_entry_details').update(r).eq('id',r.id).eq('entry_id',currentHeader.id);if(error)throw error}else{const{data,error}=await client.from('sales_entry_details').insert({entry_id:currentHeader.id,...r}).select('id').single();if(error)throw error;if(data?.id)keep.add(String(data.id))}}const{data:old,error:oe}=await client.from('sales_entry_details').select('id').eq('entry_id',currentHeader.id);if(oe)throw oe;for(const x of old||[]){if(!keep.has(String(x.id))){const{error}=await client.from('sales_entry_details').delete().eq('id',x.id).eq('entry_id',currentHeader.id);if(error)throw error}}showMessage('Saved successfully.','success');await loadSales()}catch(e){showMessage('Unable to update submitted sales: '+e.message,'error')}finally{b.disabled=false;b.textContent='SAVE CHANGES'}};
  }
});
