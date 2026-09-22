import axios from "axios";

const api = axios.create({
    baseURL: "https://jobtrack-t5yd.onrender.com/api"
});

export default api;