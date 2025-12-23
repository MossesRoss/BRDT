/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @author Mosses
 * @description Ruthless deletion of transaction chains. Handles dependency recursion automatically.
 */

define(['N/record', 'N/runtime', 'N/email', 'N/query', 'N/task', 'N/format'],
    (record, runtime, email, query, task, format) => {
        const CHAINS = {
            'O2C': [
                { type: 'customerpayment', table: 'transaction', filter: "type = 'CustPymt'" },
                { type: 'creditmemo', table: 'transaction', filter: "type = 'CustCred'" },
                { type: 'depositapplication', table: 'transaction', filter: "type = 'DepAppl'" },
                { type: 'customerdeposit', table: 'transaction', filter: "type = 'CustDep'" },
                { type: 'cashrefund', table: 'transaction', filter: "type = 'CashRfnd'" },
                { type: 'returnauthorization', table: 'transaction', filter: "type = 'RtnAuth'" },
                { type: 'itemfulfillment', table: 'transaction', filter: "type = 'ItemShip'" },
                { type: 'invoice', table: 'transaction', filter: "type = 'CustInvc'" },
                { type: 'cashsale', table: 'transaction', filter: "type = 'CashSale'" },
                { type: 'salesorder', table: 'transaction', filter: "type = 'SalesOrd'" }
            ],
            'P2P': [
                { type: 'vendorpayment', table: 'transaction', filter: "type = 'VendPymt'" },
                { type: 'vendorcredit', table: 'transaction', filter: "type = 'VendCred'" },
                { type: 'vendorbill', table: 'transaction', filter: "type = 'VendBill'" },
                { type: 'vendorreturnauthorization', table: 'transaction', filter: "type = 'VendRtnAuth'" },
                { type: 'itemreceipt', table: 'transaction', filter: "type = 'ItemRcpt'" },
                { type: 'purchaseorder', table: 'transaction', filter: "type = 'PurchOrd'" }
            ]
        };

        const getInputData = (context) => {
            const script = runtime.getCurrentScript();
            const nuclearMode = script.getParameter({ name: 'custscript007_nuclear_mode' }) === 'T';
            const nuclearChain = script.getParameter({ name: 'custscript007_nuclear_chain' });
            const targetRecordType = script.getParameter({ name: 'custscript007_record_type' });
            const deleteAllFlag = script.getParameter({ name: 'custscript007_delete_all_flag' }) === 'T';
            const specificIds = script.getParameter({ name: 'custscript007_record_ids' });

            const tasks = [];

            if (specificIds) {
                try {
                    const ids = JSON.parse(specificIds);
                    if (Array.isArray(ids)) {
                        return ids.map(id => ({ recordType: targetRecordType, id: id }));
                    }
                } catch (e) {
                    log.error('INVALID_JSON', 'Could not parse Record IDs');
                }
            }

            if (nuclearMode && nuclearChain && CHAINS[nuclearChain]) {
                const loopCount = parseInt(script.getParameter({ name: 'custscript007_loop_count' })) || 1;
                log.audit(`☢️ NUCLEAR LAUNCH [${nuclearChain}]`, `Loop ${loopCount}/5 initiated.`);

                const chainConfig = CHAINS[nuclearChain];

                chainConfig.forEach(config => {
                    try {
                        const sql = `SELECT TOP 500 id FROM ${config.table} WHERE ${config.filter}`;
                        const results = query.runSuiteQL({ query: sql }).asMappedResults();

                        results.forEach(row => {
                            tasks.push({
                                recordType: config.type,
                                id: Number(row.id)
                            });
                        });
                    } catch (e) {
                        log.error(`QUERY_FAIL_${config.type}`, e.message);
                    }
                });

                return tasks;
            }

            if (deleteAllFlag && targetRecordType) {
                log.audit('EXECUTE', `Targeting all ${targetRecordType}`);
                try {
                    const safeTable = targetRecordType.replace(/[^a-zA-Z0-9_]/g, '');
                    const sql = `SELECT id FROM ${safeTable}`;

                    const allIds = [];
                    const pagedData = query.runSuiteQLPaged({ query: sql, pageSize: 1000 });

                    pagedData.iterator().each(page => {
                        page.value.data.iterator().each(row => {
                            allIds.push({
                                recordType: targetRecordType,
                                id: Number(row.value.getValue(0))
                            });
                            return true;
                        });
                        return true;
                    });
                    return allIds;

                } catch (e) {
                    log.error('SQL_FAILED_FALLBACK', e.message);
                    throw new Error(`Could not query table ${targetRecordType}. Ensure correct SuiteQL table name.`);
                }
            }

            return [];
        };

        const map = (context) => {
            let payload;
            try {
                payload = JSON.parse(context.value);

                if (!payload.id || !payload.recordType) {
                    throw new Error('Missing ID or Record Type');
                }

                record.delete({
                    type: payload.recordType,
                    id: payload.id
                });

                context.write({
                    key: payload.id,
                    value: { status: 'S', type: payload.recordType }
                });

            } catch (e) {
                const ignore = ['RCRD_DSNT_EXIST', 'RCRD_HAS_BEEN_CHANGED'];
                if (!ignore.some(code => e.name === code)) {
                    log.error(`DELETE_FAIL [${payload ? payload.id : '?'}]`, e.message);
                    context.write({
                        key: payload ? payload.id : 'Unknown',
                        value: { status: 'F', msg: e.message }
                    });
                }
            }
        };

        const summarize = (context) => {
            const script = runtime.getCurrentScript();
            const nuclearMode = script.getParameter({ name: 'custscript007_nuclear_mode' }) === 'T';
            const nuclearChain = script.getParameter({ name: 'custscript007_nuclear_chain' });
            const currentLoop = parseInt(script.getParameter({ name: 'custscript007_loop_count' })) || 1;

            let successCount = 0;
            let failCount = 0;

            context.output.iterator().each((key, value) => {
                const res = JSON.parse(value);
                if (res.status === 'S') successCount++;
                else failCount++;
                return true;
            });

            log.audit('SUMMARY', `Loop: ${currentLoop} | Deleted: ${successCount} | Failed: ${failCount}`);

            if (nuclearMode && currentLoop < 6) {
                if (shouldTriggerNextLoop(nuclearChain)) {
                    try {
                        const nextTask = task.create({
                            taskType: task.TaskType.MAP_REDUCE,
                            scriptId: script.id,
                            deploymentId: script.deploymentId,
                            params: {
                                'custscript007_nuclear_mode': 'T',
                                'custscript007_nuclear_chain': nuclearChain,
                                'custscript007_loop_count': currentLoop + 1
                            }
                        });
                        nextTask.submit();
                        log.audit('RECURSION', `Triggered Loop ${currentLoop + 1}`);
                    } catch (e) {
                        log.emergency('RECURSION_FAILED', 'Task Queue likely full or Limit reached.');
                    }
                } else {
                    log.audit('CLEAN', 'No remaining records found. Sequence complete.');
                    sendCompletionEmail(successCount, failCount, currentLoop, "CLEAN EXIT");
                }
            } else {
                sendCompletionEmail(successCount, failCount, currentLoop, "MAX LOOPS / DONE");
            }
        };

        function shouldTriggerNextLoop(chainName) {
            if (!chainName || !CHAINS[chainName]) return false;
            const config = CHAINS[chainName];

            for (const c of config) {
                try {
                    const sql = `SELECT TOP 1 id FROM ${c.table} WHERE ${c.filter}`;
                    const res = query.runSuiteQL({ query: sql }).asMappedResults();
                    if (res.length > 0) return true;
                } catch (e) {
                }
            }
            return false;
        }

        function sendCompletionEmail(success, fail, loops, status) {
            const user = runtime.getCurrentUser().id;
            if (user > 0) {
                email.send({
                    author: user,
                    recipients: user,
                    subject: `Script Complete: ${status}`,
                    body: `Deleted: ${success}\nFailed: ${fail}\nLoops Run: ${loops}`
                });
            }
        }

        return { getInputData, map, summarize };
    });
