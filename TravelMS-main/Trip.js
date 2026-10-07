class Trip {
  constructor(
    trip_id,
    user_id,
    destination,
    start_date,
    end_date,
    purpose,
    status,
    estimated_budget,
  ) {
    this.trip_id = trip_id;
    this.user_id = user_id;
    this.destination = destination;
    this.start_date = start_date;
    this.end_date = end_date;
    this.purpose = purpose;
    this.status = status;
    this.estimated_budget = estimated_budget;
  }
}
module.exports = Trip;
