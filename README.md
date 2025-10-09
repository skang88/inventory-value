# Inventory Value Exporter for Prometheus

This application is a Prometheus exporter that provides metrics on the value of inventory by querying a Microsoft SQL Server database.

## Overview

The exporter connects to an MSSQL database, runs a complex query to gather information about inventory items (quantities, locations, prices), and then calculates various metrics. These metrics are exposed on a `/metrics` HTTP endpoint, which can be scraped by a Prometheus server.

The metrics are updated automatically every 60 seconds.

## Architecture (아키텍쳐)

The application consists of the following components:

1.  **Express Web Server:** A lightweight web server that exposes the `/metrics` endpoint.
2.  **Prometheus Client (`prom-client`):** Manages the lifecycle of Prometheus metrics (gauges in this case).
3.  **MSSQL Driver (`mssql`):** Connects to the SQL Server database to fetch inventory data.
4.  **Metrics Update Scheduler:** A simple `setInterval` loop that triggers the data fetching and metric update process every minute.

### Data Flow

```
+-------------------+      +-------------------------+      +-------------------+
| Prometheus Server |----->| Inventory Value Exporter|----->|   MSSQL Database  |
| (Scrapes /metrics)|      |  (Node.js Application)  |      | (Inventory Data)  |
+-------------------+      +-------------------------+      +-------------------+
```

1.  The exporter starts and immediately runs a SQL query to fetch inventory data.
2.  The data is processed, and Prometheus gauges are updated with the latest values.
3.  The process is repeated every 60 seconds.
4.  A Prometheus server can be configured to scrape the `/metrics` endpoint of this exporter at regular intervals.

## Metrics Exposed

The following metrics are provided:

*   `inventory_total_value`: A gauge representing the total value of all inventory.
*   `inventory_category_value`: A gauge representing the total value of inventory by category.
    *   **Labels:** `category` ('complete' or 'material')
*   `inventory_item_quantity`: A gauge for the quantity of a specific item.
    *   **Labels:** `item_no`, `item_name`, `pum_desc`, `pmj_desc`, `chj_desc`, `location`
*   `inventory_item_value`: A gauge for the value of a specific item.
    *   **Labels:** `item_no`, `item_name`, `pum_desc`, `pmj_desc`, `chj_desc`, `location`

## Configuration

Database connection details are hardcoded in `exporter.js`. You should modify the `dbConfig` object with your database credentials.

```javascript
const dbConfig = {
    user: 'your_user',
    password: 'your_password',
    server: 'your_server_ip',
    database: 'your_database',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};
```

## How to Run

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the exporter:**
    ```bash
    node exporter.js
    ```

The server will start on port 9101 by default. You can access the metrics at `http://localhost:9101/metrics`.

## Dependencies

*   `express`: Web server framework.
*   `prom-client`: Prometheus client library for Node.js.
*   `mssql`: Microsoft SQL Server client for Node.js.
