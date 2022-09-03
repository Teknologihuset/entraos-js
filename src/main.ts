import * as Booking from "./app/booking/Booking";
import EntraClient from "./app/client/EntraClient";
//import Server from "./app/server/Server";
import Server2 from "./app/server/Server2";

import dotenv from "dotenv"
dotenv.config()

export {Booking, EntraClient};

Server2.startServer();