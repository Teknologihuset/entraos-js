import {Either, isLeft, left, right} from "fp-ts/Either";
import {HttpError} from "./Errors";

import {Client, Issuer, TokenSet} from 'openid-client';

export interface ClientCredentials {
    client_id: string;
    client_secret: string;
}

export default {

    async handleJsonResponse<T>(response: Response, message?: string): Promise<Either<Error, T>> {
        let jsonResponse = await response.json();

        if (response.ok) {
            return right(jsonResponse);
        } else {
            const error = new Error(`Status ${response.status} ${response.statusText}, body: ${response.body}`)
            return left(new HttpError(`Http error: ${message ?? ""}`, error, response))
        }
    },

    async fetchOneTimeAccessToken(tokenEndpoint: string, credentials: ClientCredentials): Promise<Either<Error, TokenSet>> {

        const parameters = new URLSearchParams();
        parameters.append("grant_type", "client_credentials");

        const auth64 = Buffer.from(
            credentials.client_id + ":" + credentials.client_secret)
            .toString('base64')

        const response = await fetch(tokenEndpoint, {
            method: "post",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${auth64}`
            },
            body: parameters
        });

        const responseValue: Either<Error, TokenSet> =
            await this.handleJsonResponse<TokenSet>(response, "Could not fetch Access-Token");

        if (isLeft(responseValue)) throw responseValue.left;

        return responseValue;
    },

    async fetch(token:string, endpoint: string, options: RequestInit) {

        const response = await fetch(endpoint, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });
    },

    randomString(length: number): string {
        const possible =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmopqrstuvwxyz1234567890";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return result;
    },

    async getOidcClient(): Promise<Client> {
        const configEndpoint = process.env.ENTRAOS_CONFIG as string;
        if (!configEndpoint) throw new Error("Configuration env variable not set.");

        const clientId = process.env.TEKNOLOGIHUSET_CLIENT_ID as string;
        if (!clientId) throw new Error("Config endpoint env variable not set.");

        const clientSecret = process.env.TEKNOLOGIHUSET_CLIENT_SECRET as string;
        if (!clientSecret) throw new Error("Config endpoint env variable not set.");

        const issuer = await Issuer.discover(configEndpoint);
        console.log('Discovered issuer %s %O', issuer.issuer, issuer.metadata);

        return new issuer.Client({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uris: ["http://localhost:3000/login/callback"],
            post_logout_redirect_uris: [ 'http://localhost:3000/logout/callback' ],
            token_endpoint_auth_method: 'client_secret_post',
            token_endpoint_auth_signing_alg: "RS256",
            response_types: ["code id_token token"],
            grant_type: "authorization_code",
            scope: "openid email profile",
            response_mode: "fragment",
            default_max_age: 60000
        });
    }

}