import { IFormatter } from "./IFormatter";
import { ReportData } from "../generator/ReportData";
import * as ejs from "ejs";

export class HTMLFormatter implements IFormatter {
    private template = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Test Execution Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 2em;
      background-color: #f9f9f9;
      color: #333;
    }
    h1, h2 {
      color: #222;
    }
    .section {
      background-color: #fff;
      border-radius: 8px;
      padding: 1.5em;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      margin-bottom: 2em;
    }
    ul {
      padding-left: 1em;
    }
    li {
      margin-bottom: 0.5em;
    }
    .graph {
      white-space: pre-wrap;
      font-family: monospace;
      background: #eee;
      padding: 1em;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <h1>Test Execution Report</h1>

  <div class="section">
    <h2>Metrics</h2>
    <ul>
      <% for (const key in metrics) { %>
        <li><strong><%= key %>:</strong> <%= metrics[key] %></li>
      <% } %>
    </ul>
  </div>

  <div class="section">
    <h2>Graph Summary</h2>
    <div class="graph">
      <%= JSON.stringify(graph, null, 2) %>
    </div>
  </div>
</body>
</html>
    `;

    format(data: ReportData): string {
        return ejs.render(this.template, data);
    }
}
