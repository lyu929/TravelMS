class Report {
  constructor(report_id, trip_id, generated_by, total_expenses, report_status) {
    this.report_id = report_id;
    this.trip_id = trip_id;
    this.generated_by = generated_by;
    this.total_expenses = total_expenses;
    this.report_status = report_status;
  }
}
module.exports = Report;
