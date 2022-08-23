import {Either, isLeft, left, right} from "fp-ts/Either";
import {HttpError} from "./Errors";

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

    async fetchAuthorizationEndpoint(): Promise<string> {
        const responseValue: Either<Error, ConfigResponse> = await this.fetchConfiguration();
        if (isLeft(responseValue))
            throw new Error("Couldn't fetch AuthorizationEndpoint", responseValue.left);

        return responseValue.right.authorization_endpoint
    },

    async fetchAuthenticationToken(tokenEndpoint: string): Promise<Either<Error, TokenResponse>> {

        const clientId = process.env.TEKNOLOGIHUSET_CLIENT_ID as string;
        if (!clientId) throw new Error("Config endpoint env variable not set.");

        const clientSecret = process.env.TEKNOLOGIHUSET_CLIENT_SECRET as string;
        if (!clientSecret) throw new Error("Config endpoint env variable not set.");

        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("client_id", clientId);
        params.append("client_secret", clientSecret);

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
    }

}