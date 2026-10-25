(() => {
  const data=window.GMR_FACEBOOK_DATA,$=id=>document.getElementById(id);
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const linked=data.rows.filter(r=>r.url);
  $('counts').textContent=`${data.rows.length} base records | ${data.rows.filter(r=>r.scope==='Base page').length} base-specific matches | ${linked.length} records with a Facebook link | ${new Set(linked.map(r=>r.url)).size} distinct pages`;
  function render(){
    const query=$('directory-search').value.trim().toLowerCase(),scope=$('directory-scope').value;
    const rows=data.rows.filter(r=>(!scope||scope===r.scope)&&`${r.name} ${r.city} ${r.state} ${r.group}`.toLowerCase().includes(query));
    let group='';
    $('directory-rows').innerHTML=rows.map(r=>{
      const heading=group!==r.group?`<tr class="group-row"><th colspan="4">${escape(r.group)}</th></tr>`:'';group=r.group;
      return heading+`<tr data-base-id="${escape(r.id)}"><td><strong>${escape(r.name)}</strong>${r.mapStatus!=='Mapped base'?`<small class="map-status">${escape(r.mapStatus)}</small>`:''}</td><td>${escape(r.city)}, ${escape(r.state)}</td><td>${r.url?`<a href="${escape(r.url)}" target="_blank" rel="noopener noreferrer">Open Facebook page &#8599;</a>`:'No matching page confirmed'}<span class="scope">${escape(r.scope)}</span></td><td>${escape(r.note)}</td></tr>`;
    }).join('')||'<tr><td colspan="4" class="empty">No matching bases.</td></tr>';
    $('directory-count').textContent=`${rows.length} of ${data.rows.length} records`;
  }
  $('directory-search').addEventListener('input',render);$('directory-scope').addEventListener('change',render);render();
})();
