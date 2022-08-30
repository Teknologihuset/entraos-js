import * as Booking from "./app/booking/Booking";
import EntraClient from "./app/client/EntraClient";
import Server from "./app/server/Server";

import dotenv from "dotenv"
dotenv.config()

export {Booking, EntraClient};

Server.startServer();