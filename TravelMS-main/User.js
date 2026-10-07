class User {
  constructor(user_id, first_name, last_name, email, role, phone_number) {
    this.user_id = user_id;
    this.first_name = first_name;
    this.last_name = last_name;
    this.email = email;
    this.role = role;
    this.phone_number = phone_number;
  }
}
module.exports = User;
