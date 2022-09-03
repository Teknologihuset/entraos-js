import {Either, isLeft, left, right} from "fp-ts/Either";
import {HttpError} from "./Errors";

import {Client, generators, Issuer} from 'openid-client';

type ConfigResponse = {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    jwks_uri: string;
    end_session_endpoint: string;
    scopes_supported: Array<string>;
    response_types_supported: Array<string>;
    grant_types_supported: Array<string>;
    subject_types_supported: Array<string>;
    id_token_signing_alg_values_supported: Array<string>;
    token_endpoint_auth_methods_supported: Array<string>;
    token_endpoint_auth_signing_alg_values_supported: Array<string>;
    claims_parameter_supported: boolean;
    request_parameter_supported: boolean;
    request_uri_parameter_supported: boolean;
}

type TokenResponse = {
    access_token: string;
    expires_in: number;
    expires_at: number;
    token_type: string;
    refresh_token: string;
    id_token: string;
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

    async fetchConfiguration(): Promise<Either<Error, ConfigResponse>> {
        const configEndpoint = process.env.ENTRAOS_CONFIG as string;
        if (!configEndpoint) throw new Error("Configuration env variable not set.");

        const response = await fetch(configEndpoint);
        return this.handleJsonResponse<ConfigResponse>(response, "Couldn't fetch configuration.");
    },

    async fetchTokenEndpoint(): Promise<string> {
        const responseValue: Either<Error, ConfigResponse> = await this.fetchConfiguration();
        if (isLeft(responseValue))
            throw new Error("Couldn't fetch AuthorizationEndpoint", responseValue.left);

        return responseValue.right.token_endpoint
    },

    async fetchAccessToken(tokenEndpoint: string, code: string): Promise<Either<Error, TokenResponse>> {

        const clientId = process.env.TEKNOLOGIHUSET_CLIENT_ID as string;
        if (!clientId) throw new Error("Config endpoint env variable not set.");

        const clientSecret = process.env.TEKNOLOGIHUSET_CLIENT_SECRET as string;
        if (!clientSecret) throw new Error("Config endpoint env variable not set.");

        const code_verifier = generators.codeVerifier();
        const code_challenge = generators.codeChallenge(code_verifier);

        const params = new URLSearchParams();
        params.append("grant_type", "authorization_code");
        params.append("client_id", clientId);
        params.append("client_secret", clientSecret);
        params.append("redirect_uri", "http://127.0.0.1:3000/login/callback");
        params.append("code", code);
        params.append("code_challenge", code_challenge);
        params.append("code_challenge_method", "sha256");
        params.append("scope", "openid email profile offline_access");

        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const responseValue: Either<Error, TokenResponse> =
            await this.handleJsonResponse<TokenResponse>(response, "Could not fetch Authentication-Token");

        if (isLeft(responseValue)) throw responseValue.left;

        return responseValue;
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
            response_types: ["code"],
            grant_type: "authorization_code",
            scope: "openid email profile",
            response_mode: "fragment",
            default_max_age: 60000
        });
    }

}