import * as Booking from "./app/booking/Booking";
import EntraClient from "./app/client/EntraClient";
import Server from "./app/server/Server";

import dotenv from "dotenv"
dotenv.config()

export {Booking, EntraClient};

async function test() {
    const endpoint = await EntraClient.fetchAuthorizationEndpoint();
    console.log("endpoint", endpoint)

    const data = await EntraClient.fetchAuthenticationToken(endpoint)

    if (data) {
        console.log("Received token data", data);
    }
}

//test();

Server.startServer();