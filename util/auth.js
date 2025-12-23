import axios from "axios";

const BASE_URL = "http://192.168.0.102:8000";
const API_KEY = "AIzaSyDkZ0TKEdtQSZz0riWfxiZQchDkLcVEpC8";

const authenticate = async (mode, email, password) => {
  const url = `${BASE_URL}/dj-rest-auth/login/`;

  try {
    const response = await axios.post(
      url,
      {
        email: email,
        password: password,
      },
      {
        withCredentials: false,
      }
    );
    const token = response?.data?.access;
    return token;
  } catch (e) {
    console.log("error");
    console.log(e)
    console.log(e.response.data);
  }
};

export const CreateUser = (email, password) => {
  return authenticate("signUp", email, password);
};

export const Login = (email, password) => {
  return authenticate("signInWithPassword", email, password);
};
