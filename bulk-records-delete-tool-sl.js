/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * @version 2.2.0
 * @author Mosses
 *
 * Change Log:
 * - v2.2.0 (2025-12-23):
 * - FEAT: Added "Nuclear Option" for O2C and P2P chains.
 * - FEAT: Added intelligent looping UI triggers.
 * - v2.1.0 (2025-11-12):
 * - FEAT: Added comprehensive list of transaction types.
 */

var serverWidget, query, record, log, search, task;
const Modules = [
    'N/ui/serverWidget',
    'N/query',
    'N/record',
    'N/log',
    'N/search',
    'N/task'
];

define(Modules, main);

function main(swModule, queryModule, recordModule, logModule, searchModule, taskModule) {
    serverWidget = swModule;
    query = queryModule;
    record = recordModule;
    log = logModule;
    search = searchModule;
    task = taskModule;

    return { onRequest };
}

const onRequest = (scriptContext) => {
    if (scriptContext.request.method === 'GET') {
        handleGetRequest(scriptContext.response);
    } else {
        handlePostRequest(scriptContext.request, scriptContext.response);
    }
};

const handleGetRequest = (response) => {
    const form = serverWidget.createForm({
        title: 'Bulk Record Deleter'
    });

    const htmlContainer = form.addField({
        id: 'custpage_html_container',
        type: serverWidget.FieldType.INLINEHTML,
        label: ' '
    });

    htmlContainer.defaultValue = buildClientUI();
    response.writePage(form);
};

const getRecordTypes = () => {
    const recordTypes = [
        // Sales Cycle
        { value: 'deposit', text: 'Deposit' },
        { value: 'customerpayment', text: 'Customer Payment' },
        { value: 'creditmemo', text: 'Credit Memo' },
        { value: 'cashrefund', text: 'Cash Refund' },
        { value: 'invoice', text: 'Invoice' },
        { value: 'cashsale', text: 'Cash Sale' },
        { value: 'returnauthorization', text: 'Return Authorization' },
        { value: 'itemfulfillment', text: 'Item Fulfillment' },
        { value: 'salesorder', text: 'Sales Order' },
        { value: 'estimate', text: 'Quote / Estimate' },

        // Purchasing Cycle
        { value: 'vendorpayment', text: 'Bill Payment' },
        { value: 'vendorcredit', text: 'Vendor Credit' },
        { value: 'vendorbill', text: 'Vendor Bill' },
        { value: 'vendorreturnauthorization', text: 'Vendor Return Authorization' },
        { value: 'itemreceipt', text: 'Item Receipt' },
        { value: 'purchaseorder', text: 'Purchase Order' },
        { value: 'purchaserequisition', text: 'Requisition' },

        // Inventory / Financials
        { value: 'transferorder', text: 'Transfer Order' },
        { value: 'journalentry', text: 'Journal Entry' },
        { value: 'customer', text: 'Customer' },
        { value: 'vendor', text: 'Vendor' },
        { value: 'contact', text: 'Contact' },
        { value: 'employee', text: 'Employee' }
    ];

    try {
        const customRecordQuery = query.runSuiteQL({
            query: "SELECT scriptid, name FROM customrecordtype WHERE isinactive = 'F' ORDER BY name"
        }).asMappedResults();

        customRecordQuery.forEach(cr => {
            recordTypes.push({ value: cr.scriptid, text: cr.name });
        });
    } catch (e) {
        log.error('Failed to query custom record types', e);
    }

    return recordTypes.sort((a, b) => a.text.localeCompare(b.text));
};

const buildClientUI = () => {
    const recordTypes = getRecordTypes();
    let optionsHtml = '';
    recordTypes.forEach(rt => {
        optionsHtml += "<option value='" + rt.text + "'></option>";
    });
    
    const recordTypeMapJS = "const recordTypeMap = " + JSON.stringify(recordTypes.reduce((acc, rt) => {
        acc[rt.text] = rt.value;
        return acc;
    }, {})) + ";";


    let html = "";
    html += "<style>";
    html += "body, html { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f2f5; margin: 0; padding: 0; height: 100%; overflow: hidden; }";
    html += "* { box-sizing: border-box; }";
    html += ".app-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; width: 100%; }";
    html += ".view { width: 100%; height: 100%; display: none; flex-direction: column; }";
    html += ".view.active { display: flex; }";
    html += "/* --- Selection View --- */";
    html += "#selection-view { justify-content: center; align-items: center; text-align: center; }";
    html += ".selection-box h1 { font-size: 2.5rem; font-weight: 300; color: #333; letter-spacing: -1px; margin-bottom: 30px; }";
    html += ".input-group { display: flex; justify-content: center; align-items: center; margin-bottom: 20px; width: 100%; max-width: 550px; }";
    html += "#recordTypeInput { font-size: 1.1rem; padding: 12px 20px; border-radius: 50px; border: 1px solid #ccc; width: 100%; max-width: 400px; text-align: center; margin-bottom: 20px; }";
    html += "#loadRecordsBtn { font-size: 1.0rem; padding: 10px 25px; border-radius: 50px; border: 1px solid #007bff; background-color: #007bff; color: white; cursor: pointer; transition: all 0.2s ease; margin-right: 10px; }";
    html += "#loadRecordsBtn:hover { background-color: #0069d9; }";
    html += "#deleteAllBtn { font-size: 1.0rem; padding: 10px 25px; border-radius: 50px; border: 1px solid #d93025; background-color: white; color: #d93025; cursor: pointer; transition: all 0.2s ease; }";
    html += "#deleteAllBtn:hover { background-color: #d93025; color: white; }";
    html += "#nuclearBtn { margin-top: 30px; font-size: 0.9rem; padding: 10px 30px; border-radius: 5px; border: none; background-color: #333; color: #ffeb3b; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: transform 0.2s; }";
    html += "#nuclearBtn:hover { transform: scale(1.05); background-color: #000; }";
    html += "/* --- List View --- */";
    html += "#list-view { background-color: #fff; position: relative; }";
    html += ".list-header { display: flex; align-items: center; padding: 15px 25px; border-bottom: 1px solid #e0e0e0; position: sticky; top: 0; background: white; z-index: 10; }";
    html += ".back-arrow { font-size: 24px; cursor: pointer; margin-right: 20px; color: #5f6368; line-height: 1; }";
    html += ".list-header h2 { margin: 0; font-size: 1.2rem; font-weight: 500; color: #333; }";
    html += ".list-controls { margin-left: auto; display: flex; align-items: center; }";
    html += "#selectAllLabel { display: flex; align-items: center; cursor: pointer; font-size: 14px; color: #555; }";
    html += "#selectAll { margin-right: 8px; width: 18px; height: 18px; }";
    html += ".record-list-container { overflow-y: auto; height: calc(100vh - 66px); padding: 0 10px; user-select: none; position: relative; }";
    html += ".record-item { display: flex; align-items: center; padding: 15px; border-bottom: 1px solid #f0f0f0; transition: background-color 0.2s ease; cursor: pointer; }";
    html += ".record-item:hover { background-color: #f9f9f9; }";
    html += ".record-item input[type='checkbox'] { width: 20px; height: 20px; margin-right: 20px; cursor: pointer; flex-shrink: 0; }";
    html += ".record-details { display: flex; flex-direction: column; }";
    html += ".record-docId { font-weight: 500; color: #202124; margin-bottom: 3px; }";
    html += ".record-name { font-size: 0.9rem; color: #5f6368; }";
    html += ".no-records { text-align: center; padding: 50px; color: #777; font-size: 1.1rem; }";
    html += "/* FAB */";
    html += "#delete-fab { position: fixed; bottom: 30px; right: 30px; width: 150px; height: 56px; background-color: #d93025; color: white; border: none; border-radius: 28px; font-size: 1rem; font-weight: 500; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.2); transition: transform 0.2s ease, opacity 0.3s ease; transform: scale(0); opacity: 0; }";
    html += "#delete-fab.visible { transform: scale(1); opacity: 1; }";
    html += "/* Loader & Status */";
    html += ".loader-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.8); display: flex; justify-content: center; align-items: center; z-index: 9999; }";
    html += ".loader { border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; }";
    html += "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
    html += ".hidden { display: none; }";
    html += "#statusMessage { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(100px); padding: 12px 25px; border-radius: 8px; font-size: 14px; z-index: 1000; opacity: 0; transition: all 0.5s ease; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }";
    html += "#statusMessage.show { opacity: 1; transform: translateX(-50%) translateY(0); }";
    html += ".status-success { background-color: #333; color: white; }";
    html += ".status-error { background-color: #d93025; color: white; }";
    html += "/* Drag-to-select Marquee */";
    html += "#selection-marquee { position: absolute; border: 1px dashed #007bff; background-color: rgba(0, 123, 255, 0.2); pointer-events: none; display: none; z-index: 100; }";
    html += "/* Modal Styles */";
    html += ".modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10000; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }";
    html += ".modal-overlay.visible { opacity: 1; pointer-events: auto; }";
    html += ".modal { background: white; padding: 25px 30px; border-radius: 8px; width: 90%; max-width: 500px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); transform: scale(0.9); transition: transform 0.3s ease; }";
    html += ".modal-overlay.visible .modal { transform: scale(1); }";
    html += ".modal-header { border-bottom: 1px solid #e0e0e0; padding-bottom: 15px; margin-bottom: 20px; }";
    html += ".modal-header h2 { margin: 0; font-size: 1.3rem; color: #333; }";
    html += ".modal-body p { margin: 0 0 15px; color: #555; line-height: 1.6; }";
    html += ".modal-footer { text-align: right; margin-top: 25px; }";
    html += ".modal-button { padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: background-color 0.2s ease; }";
    html += ".modal-button-primary { background-color: #007bff; color: white; margin-left: 10px; }";
    html += ".modal-button-primary:hover { background-color: #0069d9; }";
    html += "#confirm-modal-ok { background-color: #d93025; }";
    html += "#confirm-modal-ok:hover { background-color: #c5221b; }";
    html += ".modal-button-secondary { background-color: #f0f0f0; color: #333; }";
    html += ".modal-button-secondary:hover { background-color: #e0e0e0; }";
    html += "/* Nuclear Modal */";
    html += "#nuclear-options { display: flex; gap: 15px; justify-content: center; margin-top: 20px; }";
    html += ".nuclear-option-btn { flex: 1; padding: 15px; border: 2px solid #ccc; border-radius: 8px; background: white; cursor: pointer; font-weight: bold; color: #555; transition: all 0.2s; }";
    html += ".nuclear-option-btn:hover { border-color: #d93025; color: #d93025; background: #fff5f5; }";
    html += ".nuclear-option-btn.selected { border-color: #d93025; background: #d93025; color: white; }";
    html += "</style>";

    html += "<div id='loader-overlay' class='loader-overlay hidden'><div class='loader'></div></div>";
    html += "<div id='statusMessage'></div>";

    html += "<div id='selection-view' class='view active'>";
    html += "<div class='selection-box'>";
    html += "<h1>Delete Records with ease</h1>";
    html += "<input type='text' id='recordTypeInput' list='recordTypeDatalist' placeholder='Search or select record type...'>";
    html += "<datalist id='recordTypeDatalist'>" + optionsHtml + "</datalist>";
    html += "<div class='action-buttons'>";
    html += "<button id='loadRecordsBtn' type='button'>Load Records</button>";
    html += "<button id='deleteAllBtn' type='button'>Delete All Records</button>";
    html += "</div>";
    html += "<button id='nuclearBtn' type='button'>⚠️ Nuclear Option</button>";
    html += "</div>";
    html += "</div>";

    html += "<div id='list-view' class='view'>";
    html += "<div class='list-header'>";
    html += "<span class='back-arrow' title='Go Back'>&#8592;</span>";
    html += "<h2 id='list-title'></h2>";
    html += "<div class='list-controls'>";
    html += "<label id='selectAllLabel'><input type='checkbox' id='selectAll'/>&nbsp;Select All</label>";
    html += "</div>";
    html += "</div>";
    html += "<div class='record-list-container' id='resultsContainer'>";
    html += "<div id='selection-marquee'></div>";
    html += "</div>";
    html += "<button id='delete-fab' type='button'>Delete</button>";
    html += "</div>";

    html += "<!-- Custom Confirm Modal -->";
    html += "<div id='confirm-modal' class='modal-overlay'>";
    html += "<div class='modal'>";
    html += "<div class='modal-header'>";
    html += "<h2>Are you sure?</h2>";
    html += "</div>";
    html += "<div class='modal-body'>";
    html += "<p id='confirm-modal-text'></p>";
    html += "</div>";
    html += "<div class='modal-footer'>";
    html += "<button id='confirm-modal-cancel' type='button' class='modal-button modal-button-secondary'>Cancel</button>";
    html += "<button id='confirm-modal-ok' type='button' class='modal-button modal-button-primary'>Delete</button>";
    html += "</div>";
    html += "</div>";
    html += "</div>";

    html += "<!-- Nuclear Option Modal -->";
    html += "<div id='nuclear-modal' class='modal-overlay'>";
    html += "<div class='modal'>";
    html += "<div class='modal-header'>";
    html += "<h2 style='color: #d93025;'>☢️ Nuclear Option</h2>";
    html += "</div>";
    html += "<div class='modal-body'>";
    html += "<p>Select a transaction cycle to completely wipe. The system will loop up to 5 times to clear dependencies.</p>";
    html += "<div id='nuclear-options'>";
    html += "<button class='nuclear-option-btn' data-type='O2C'>1. P2P (Procure to Pay)</button>";
    html += "<button class='nuclear-option-btn' data-type='P2P'>2. O2C (Order to Cash)</button>";
    html += "</div>";
    html += "</div>";
    html += "<div class='modal-footer'>";
    html += "<button id='nuclear-cancel' type='button' class='modal-button modal-button-secondary'>Cancel</button>";
    html += "<button id='nuclear-launch' type='button' class='modal-button' style='background-color:#d93025; color:white; display:none;'>LAUNCH</button>";
    html += "</div>";
    html += "</div>";
    html += "</div>";

    html += "<script>";
    html += recordTypeMapJS;

    html += "(function() {";
    html += "let globalRecordType = '';";
    html += "let selectedNuclearType = '';";
    html += "const selectionView = document.getElementById('selection-view');";
    html += "const recordTypeInput = document.getElementById('recordTypeInput');";
    html += "const loadRecordsBtn = document.getElementById('loadRecordsBtn');";
    html += "const deleteAllBtn = document.getElementById('deleteAllBtn');";
    html += "const nuclearBtn = document.getElementById('nuclearBtn');";
    html += "const deleteFab = document.getElementById('delete-fab');";
    html += "const loader = document.getElementById('loader-overlay');";
    html += "const statusMessage = document.getElementById('statusMessage');";
    html += "const resultsContainer = document.getElementById('resultsContainer');";
    html += "const selectAllCheckbox = document.getElementById('selectAll');";
    html += "const marquee = document.getElementById('selection-marquee');";
    html += "const confirmModal = document.getElementById('confirm-modal');";
    html += "const nuclearModal = document.getElementById('nuclear-modal');";
    html += "const suiteletUrl = window.location.href;";

    html += "const showView = (viewId) => {";
    html += "document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));";
    html += "document.getElementById(viewId).classList.add('active');";
    html += "};";

    html += "const showLoader = (show) => loader.classList.toggle('hidden', !show);";

    html += "const showStatus = (message, isError = false) => {";
    html += "statusMessage.textContent = message;";
    html += "statusMessage.className = isError ? 'status-error' : 'status-success';";
    html += "statusMessage.classList.add('show');";
    html += "setTimeout(() => statusMessage.classList.remove('show'), 4000);";
    html += "};";

    html += "const showConfirm = (text) => {";
    html += "return new Promise((resolve) => {";
    html += "document.getElementById('confirm-modal-text').textContent = text;";
    html += "confirmModal.classList.add('visible');";
    html += "const okButton = document.getElementById('confirm-modal-ok');";
    html += "const cancelButton = document.getElementById('confirm-modal-cancel');";
    html += "const close = (value) => {";
    html += "confirmModal.classList.remove('visible');";
    html += "okButton.onclick = null;";
    html += "cancelButton.onclick = null;";
    html += "resolve(value);";
    html += "};";
    html += "okButton.onclick = () => close(true);";
    html += "cancelButton.onclick = () => close(false);";
    html += "});";
    html += "};";

    // --- Nuclear Logic ---
    html += "nuclearBtn.addEventListener('click', () => { nuclearModal.classList.add('visible'); });";
    html += "document.getElementById('nuclear-cancel').addEventListener('click', () => { nuclearModal.classList.remove('visible'); selectedNuclearType=''; updateNuclearUI(); });";
    
    html += "const nuclearOptionBtns = document.querySelectorAll('.nuclear-option-btn');";
    html += "const nuclearLaunchBtn = document.getElementById('nuclear-launch');";
    
    html += "const updateNuclearUI = () => {";
    html += "nuclearOptionBtns.forEach(btn => {";
    html += "if (btn.dataset.type === selectedNuclearType) btn.classList.add('selected');";
    html += "else btn.classList.remove('selected');";
    html += "});";
    html += "nuclearLaunchBtn.style.display = selectedNuclearType ? 'inline-block' : 'none';";
    html += "};";

    html += "nuclearOptionBtns.forEach(btn => {";
    html += "btn.addEventListener('click', () => { selectedNuclearType = btn.dataset.type; updateNuclearUI(); });";
    html += "});";

    html += "nuclearLaunchBtn.addEventListener('click', async () => {";
    html += "if (!selectedNuclearType) return;";
    html += "nuclearModal.classList.remove('visible');";
    html += "const confirmed = await showConfirm('CONFIRM: Initiate 5-Loop Nuclear Deletion for ' + selectedNuclearType + '? This cannot be undone.');";
    html += "if (!confirmed) return;";
    html += "showLoader(true);";
    html += "try {";
    html += "const response = await fetch(suiteletUrl, {";
    html += "method: 'POST',";
    html += "headers: {'Content-Type': 'application/json'},";
    html += "body: JSON.stringify({ action: 'nuclear_delete', chainType: selectedNuclearType })";
    html += "});";
    html += "const result = await response.json();";
    html += "if (result.taskId) {";
    html += "showStatus('Nuclear Loop 1/5 initiated (Task: ' + result.taskId + '). You will receive an email summary.', false);";
    html += "} else { throw new Error(result.error); }";
    html += "} catch (e) { showStatus('Error: ' + e.message, true); }";
    html += "finally { showLoader(false); selectedNuclearType=''; updateNuclearUI(); }";
    html += "});";

    // --- Standard Logic ---
    html += "const updateFabVisibility = () => {";
    html += "const anyChecked = document.querySelectorAll('.record-checkbox:checked').length > 0;";
    html += "deleteFab.classList.toggle('visible', anyChecked);";
    html += "};";

    html += "const displayRecords = (records, recordTypeName) => {";
    html += "document.getElementById('list-title').textContent = recordTypeName;";
    html += "if (records.length === 0) {";
    html += "resultsContainer.innerHTML = '<div class=\"no-records\">No records found for this type.</div>';";
    html += "return;";
    html += "}";
    html += "let listHtml = '';";
    html += "records.forEach(rec => {";
    html += "const docId = rec.docId ? rec.docId.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'ID: ' + rec.id;";
    html += "const name = rec.name ? rec.name.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';";
    html += "listHtml += ";
    html += "'<div class=\"record-item\">' +";
    html += "'<input type=\"checkbox\" class=\"record-checkbox\" value=\"' + rec.id + '\">' +";
    html += "'<div class=\"record-details\">' +";
    html += "'<div class=\"record-docId\">' + docId + '</div>' +";
    html += "'<div class=\"record-name\">' + name + '</div>' +";
    html += "'</div>' +";
    html += "'</div>';";
    html += "});";
    html += "resultsContainer.innerHTML = listHtml;";
    html += "document.querySelectorAll('.record-item').forEach(item => { item.addEventListener('click', (e) => { if (e.target.type === 'checkbox') return; const cb = item.querySelector('.record-checkbox'); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); } }); });";
    html += "document.querySelectorAll('.record-checkbox').forEach(cb => cb.addEventListener('change', updateFabVisibility));";
    html += "};";

    html += "const fetchRecords = async () => {";
    html += "const recordTypeName = recordTypeInput.value;";
    html += "const recordType = recordTypeMap[recordTypeName];";
    html += "if (!recordType) { if(recordTypeName.trim() !== '') showStatus('Please select a valid record type.', true); return; }";
    html += "globalRecordType = recordType;";
    html += "showLoader(true); deleteFab.classList.remove('visible'); selectAllCheckbox.checked = false;";
    html += "try {";
    html += "const response = await fetch(suiteletUrl, { method: 'POST', body: JSON.stringify({ action: 'get_records', recordType: recordType }) });";
    html += "const data = await response.json();";
    html += "if(data.error) throw new Error(data.error);";
    html += "displayRecords(data.results, recordTypeName); showView('list-view');";
    html += "} catch (error) { showStatus('Fetch Error: ' + error.message, true); } finally { showLoader(false); }";
    html += "};";

    html += "const deleteRecords = async () => {";
    html += "const selectedIds = Array.from(document.querySelectorAll('.record-checkbox:checked')).map(cb => cb.value);";
    html += "if (selectedIds.length === 0) return;";
    html += "if (!await showConfirm('Delete ' + selectedIds.length + ' record(s)?')) return;";
    html += "showLoader(true);";
    html += "try {";
    html += "const response = await fetch(suiteletUrl, { method: 'POST', body: JSON.stringify({ action: 'delete_records', recordType: globalRecordType, recordIds: selectedIds }) });";
    html += "const result = await response.json();";
    html += "if (result.taskId) { showStatus('Task ' + result.taskId + ' submitted.', false); setTimeout(() => { document.querySelector('.back-arrow').click(); }, 2500); }";
    html += "else throw new Error(result.error);";
    html += "} catch (error) { showStatus('Error: ' + error.message, true); } finally { showLoader(false); }";
    html += "};";

    html += "const deleteAllRecords = async () => {";
    html += "const recordTypeName = recordTypeInput.value; const recordType = recordTypeMap[recordTypeName];";
    html += "if (!recordType) { showStatus('Select a record type first.', true); return; }";
    html += "if (!await showConfirm('EXTREME DANGER: Delete ALL records of type \\'' + recordTypeName + '\\'?')) return;";
    html += "showLoader(true);";
    html += "try {";
    html += "const response = await fetch(suiteletUrl, { method: 'POST', body: JSON.stringify({ action: 'delete_all_records', recordType: recordType }) });";
    html += "const result = await response.json();";
    html += "if (result.taskId) { showStatus('Delete ALL task ' + result.taskId + ' submitted.', false); recordTypeInput.value = ''; }";
    html += "else throw new Error(result.error);";
    html += "} catch (error) { showStatus('Error: ' + error.message, true); } finally { showLoader(false); }";
    html += "};";

    html += "loadRecordsBtn.addEventListener('click', fetchRecords);";
    html += "deleteAllBtn.addEventListener('click', deleteAllRecords);";
    html += "document.querySelector('.back-arrow').addEventListener('click', () => { showView('selection-view'); recordTypeInput.value = ''; });";
    html += "deleteFab.addEventListener('click', deleteRecords);";
    html += "selectAllCheckbox.addEventListener('change', (e) => { document.querySelectorAll('.record-checkbox').forEach(cb => cb.checked = e.target.checked); updateFabVisibility(); });";

    html += "const hideNsUi = () => { const els = ['#ns_header-wrapper', '.ns-header', '.uir-header-buttons', '#div__header']; els.forEach(s => { const el = document.querySelector(s); if(el) el.style.display='none'; }); const main = document.querySelector('.uir-page-title-firstline'); if(main) main.style.paddingTop='0'; };";
    html += "new MutationObserver(() => hideNsUi()).observe(document.body, { childList: true, subtree: true }); hideNsUi();";
    html += "})();";
    html += "</script>";

    return html;
};

const handlePostRequest = (request, response) => {
    let body;
    try {
        if (!request.body || request.body.trim() === '') throw new Error('Empty body');
        body = JSON.parse(request.body);
    } catch (e) {
        response.write(JSON.stringify({ error: 'Invalid JSON' }));
        return;
    }

    try {
        const { action } = body;
        if (action === 'get_records') {
            getAndReturnRecords(body.recordType, response);
        } else if (action === 'delete_records') {
            submitDeletionTask(body, response);
        } else if (action === 'delete_all_records') {
            submitDeleteAllTask(body, response);
        } else if (action === 'nuclear_delete') {
            submitNuclearTask(body, response);
        } else {
            throw new Error('Invalid action.');
        }
    } catch (e) {
        log.error({ title: 'POST Error', details: e });
        response.write(JSON.stringify({ error: e.message }));
    }
};

const getAndReturnRecords = (recordType, response) => {
    const isCustom = recordType.toLowerCase().startsWith('customrecord');
    let docIdCol, nameCol;

    if (isCustom) {
        docIdCol = 'name';
        nameCol = "''";
    } else {
        const entityTypes = ['customer', 'vendor', 'employee', 'contact'];
        if (entityTypes.includes(recordType.toLowerCase())) {
            docIdCol = 'entityid'; nameCol = 'altname';
        } else {
            docIdCol = 'tranid'; nameCol = "NVL(memo, '')";
        }
    }
    // Fallback for types without tranid might be needed, but assuming transaction/entity types for now
    const sql = `SELECT TOP 5000 id, ${docIdCol} AS "docId", ${nameCol} AS "name" FROM ${recordType} ORDER BY id DESC`;

    try {
        const results = query.runSuiteQL({ query: sql }).asMappedResults();
        response.setHeader({ name: 'Content-Type', value: 'application/json' });
        response.write(JSON.stringify({ results: results }));
    } catch (e) {
        response.code = 400;
        response.write(JSON.stringify({ error: `Query failed for ${recordType}: ${e.message}` }));
    }
};

const submitDeletionTask = (body, response) => {
    submitTask({
        'custscript007_record_type': body.recordType,
        'custscript007_record_ids': JSON.stringify(body.recordIds)
    }, response);
};

const submitDeleteAllTask = (body, response) => {
    submitTask({
        'custscript007_record_type': body.recordType,
        'custscript007_delete_all_flag': 'T'
    }, response);
};

const submitNuclearTask = (body, response) => {
    submitTask({
        'custscript007_nuclear_mode': 'T',
        'custscript007_nuclear_chain': body.chainType,
        'custscript007_loop_count': 1 // Start at Loop 1
    }, response);
};

const submitTask = (params, response) => {
    try {
        const mapReduceTask = task.create({
            taskType: task.TaskType.MAP_REDUCE,
            scriptId: 'customscript_bulk_delete_tool_mr',
            deploymentId: 'customdeploy_bulk_delete_tool_mr',
            params: params
        });
        const taskId = mapReduceTask.submit();
        response.setHeader({ name: 'Content-Type', value: 'application/json' });
        response.write(JSON.stringify({ taskId: taskId }));
    } catch (e) {
        log.error('Task Submit Error', e);
        response.code = 500;
        response.write(JSON.stringify({ error: e.message }));
    }
};
