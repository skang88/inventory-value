const express = require('express');
const client = require('prom-client');
const sql = require('mssql');

// --- DB 연결 설정 ---
const dbConfig = {
    user: 'seokgyun',
    password: '1q2w3e4r',
    server: '172.16.220.3',
    database: 'SAG',
    options: {
        encrypt: false, // MSSQL Azure가 아닌 경우 false로 설정
        trustServerCertificate: true // 로컬 또는 자체 서명된 인증서 사용 시 true
    }
};

// --- Prometheus Metric 정의 ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const inventory_total_value = new client.Gauge({
    name: 'inventory_total_value',
    help: 'Total value of all inventory'
});

const inventory_category_value = new client.Gauge({
    name: 'inventory_category_value',
    help: 'Total value of inventory by category (complete, material)',
    labelNames: ['category']
});

// 코드 설명을 레이블로 사용하도록 변경
const inventory_item_quantity = new client.Gauge({
    name: 'inventory_item_quantity',
    help: 'Quantity of a specific item by location',
    labelNames: ['item_no', 'item_name', 'pum_desc', 'pmj_desc', 'chj_desc', 'location']
});

const inventory_item_value = new client.Gauge({
    name: 'inventory_item_value',
    help: 'Value of a specific item by location',
    labelNames: ['item_no', 'item_name', 'pum_desc', 'pmj_desc', 'chj_desc', 'location']
});

register.registerMetric(inventory_total_value);
register.registerMetric(inventory_category_value);
register.registerMetric(inventory_item_quantity);
register.registerMetric(inventory_item_value);


// --- SQL 쿼리 ---
const query = `
WITH Quantities AS (
    -- Standby
    SELECT ITMNO, 'Standby' AS Location, SUM(JQTY) AS Qty
    FROM SAG.dbo.MAT_ITMBLPFSUB
    WHERE WARHS IN ('F01', 'R01', 'C01', 'F31') AND JQTY > 0
    GROUP BY ITMNO
    UNION ALL
    -- Rack
    SELECT ITMNO, 'Rack' AS Location, SUM(JQTY) AS Qty
    FROM SAG.dbo.MAT_ITMBLPFSUB
    WHERE WARHS IN ('AB') AND JQTY > 0
    GROUP BY ITMNO
    UNION ALL
    -- Complete
    SELECT ITMNO, 'Complete' AS Location, SUM(JQTY) AS Qty
    FROM SAG.dbo.MAT_ITMBLPFSUB
    WHERE WARHS IN ('AA') AND JQTY > 0
    GROUP BY ITMNO
    UNION ALL
    -- Lotin
    SELECT ITMNO, 'Lotin' AS Location, SUM(J_QTY) AS Qty
    FROM SAG.dbo.PRD_LOTIN
    WHERE LINE IN ('F01', 'R01', 'C01', 'F31') AND J_QTY > 0
    GROUP BY ITMNO
)
SELECT
    q.ITMNO,
    q.Location,
    q.Qty,
    d.DANGA AS UnitPrice,
    i.ITM_NM,
    -- PUM_CD를 설명으로 매핑
    CASE i.PUM_CD
        WHEN 'C' THEN 'Component'
        WHEN 'D' THEN 'Raw Material'
        WHEN 'F' THEN 'Hardware'
        WHEN 'A' THEN 'Complete'
        ELSE i.PUM_CD
    END AS PUM_DESC,
    -- PMJ_CD를 설명으로 매핑 (없으면 원래 코드값 사용)
    ISNULL(pmj.ASDES, i.PMJ_CD) AS PMJ_DESC,
    -- CHJ_CD를 설명으로 매핑 (없으면 원래 코드값 사용)
    ISNULL(chj.ASDES, i.CHJ_CD) AS CHJ_DESC
FROM Quantities q
-- 품목 정보 조인 (단종 품목 필터링)
INNER JOIN SAG.dbo.BAS_ITMSTPF i ON q.ITMNO = i.ITMNO AND i.ACT_GB <> 'Z'
-- 단가 정보 조인
LEFT JOIN SAG.dbo.BAS_DANGA d ON q.ITMNO = d.ITMNO
    -- 단가 적용 로직: '49560-DO000' 품목에만 특별 로직(AA/BB)을 적용하고, 그 외에는 PRC_CD와 상관없이 단가를 가져옵니다.
    AND d.PRC_CD = CASE WHEN q.ITMNO = '49560-DO000' THEN (CASE WHEN q.Location = 'Complete' THEN 'AA' ELSE 'BB' END) ELSE d.PRC_CD END
-- PMJ_CD 설명 조인
LEFT JOIN SAG.dbo.COM_ACODERP pmj ON i.PMJ_CD = pmj.ASGUB AND pmj.ADGUB = 'M03'
-- CHJ_CD 설명 조인
LEFT JOIN SAG.dbo.COM_ACODERP chj ON i.CHJ_CD = chj.ASGUB AND chj.ADGUB = 'P03'
-- ===== 추가된 제외 조건 =====
WHERE q.ITMNO NOT IN ('49592-B1000', '49592-F0000', '49592-C1000')
`;

// --- 메트릭 업데이트 함수 ---
async function updateMetrics() {
    console.log('Updating metrics...');
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request().query(query);

        let totalValue = 0;
        let completeValue = 0;
        let materialValue = 0;

        // Reset per-item gauges to remove old entries
        inventory_item_quantity.reset();
        inventory_item_value.reset();

        for (const row of result.recordset) {
            const itemValue = row.Qty * (row.UnitPrice || 0);
            // 레이블에 코드 대신 설명(DESC) 필드 사용
            const labels = {
                item_no: row.ITMNO,
                item_name: row.ITM_NM,
                pum_desc: row.PUM_DESC,
                pmj_desc: row.PMJ_DESC,
                chj_desc: row.CHJ_DESC,
                location: row.Location
            };

            inventory_item_quantity.set(labels, row.Qty);
            inventory_item_value.set(labels, itemValue);

            totalValue += itemValue;
            if (row.Location === 'Complete') {
                completeValue += itemValue;
            } else {
                materialValue += itemValue;
            }
        }

        inventory_total_value.set(totalValue);
        inventory_category_value.labels('complete').set(completeValue);
        inventory_category_value.labels('material').set(materialValue);

        console.log('Metrics updated successfully.');

    } catch (err) {
        console.error('Error updating metrics:', err);
    } finally {
        if (pool) {
            pool.close();
        }
    }
}

// --- 서버 설정 및 실행 ---
const app = express();

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (ex) {
        res.status(500).end(ex);
    }
});

const port = process.env.PORT || 9101;

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Metrics exposed at http://localhost:${port}/metrics`);
    
    // 서버 시작 시 즉시 1회 실행 후, 1분마다 주기적으로 실행
    updateMetrics();
    setInterval(updateMetrics, 60 * 1000); // 60 seconds
});