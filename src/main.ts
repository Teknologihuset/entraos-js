import * as Booking from "./app/booking/Booking";
import Client from "./app/client/Client";
import Server from "./app/server/Server"

export {Booking, Client, Server};

(async () => {
    const endpoint = await Client.fetchAuthorizationEndpoint();
    console.log("endpoint", endpoint)

    const data = await Client.fetchAuthenticationToken(endpoint)

    if (data) {
        console.log("Received token data", data);
    }
})()

Server.startServer();