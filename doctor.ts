import { runDoctorChecks } from "./src/doctor/checks.ts";

const report = await runDoctorChecks();
console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  Deno.exit(1);
}
