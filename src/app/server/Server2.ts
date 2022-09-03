import express, { Express, Request, Response } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import session from "express-session";
import {Strategy, TokenSet, generators} from "openid-client";
import EntraClient from "../client/EntraClient";
import path from "path";
import logger from "morgan";
import createError from "http-errors";
import type { ErrorRequestHandler } from "express";

import indexRouter from "../routes/index";
import usersRouter from "../routes/users"

type User = {
    id: string;
    email: string;
};

declare module "express-session" {
    interface SessionData {
        user: User,
        sessionData: {
            code_verifier: string,
            nonce: string,
            state: string
        },
        tokenSet: TokenSet
    }
}

const app: Express = express();
const port = process.env.PORT || 3000;

app.set('views', path.join(__dirname, "..", "views"));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "..", "..", "public")));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', indexRouter);

EntraClient.getOidcClient().then(client => {

    let cookie = {};
    if (app.get('env') === 'production') {
        cookie = { secure: true };
    }

    app.use(
        session({
            secret: 'secret',
            resave: false,
            saveUninitialized: false,
            cookie
        })
    );

    app.use(helmet());

    app.use('/user', usersRouter);

    app.get('/login', (req, res, next) => {
        const code_verifier = generators.codeVerifier();
        const code_challenge = generators.codeChallenge(code_verifier);
        const nonce = generators.nonce();
        const state = generators.state();

        req.session.sessionData = {
            code_verifier,
            nonce,
            state
        }

        const authorizationUrl =  client.authorizationUrl({
            response_type: "code",
            response_mode: "fragment",
            client_id: client.metadata.client_id,
            scope: 'openid email profile',
            code_challenge,
            code_challenge_method: 'S256',
            state,
            //nonce
        });

        res.redirect(authorizationUrl)
    });

    app.get('/login/callback', async (req, res, next) => {
        console.log("callback called")

        const params = client.callbackParams(req);
        const code_verifier = req.session.sessionData?.code_verifier;
        const state = req.session.sessionData?.state;
        const nonce = req.session.sessionData?.nonce;

        if (!code_verifier) {
            throw new Error("missing code_verifier");
        }

        if (!state || state !== params.state) {
            console.error("ERROR: Invalid state.");
            res.redirect("/");
        }

        if (params.error || params.error_description) {
            console.error("ERROR: params.error: ", params.error_description || params.error);
            res.redirect("/");
        }

        if (params.code) {
            const grant_type = "authorization_code";
            const parameters: Record<string, string> = {
                client_id: client.metadata.client_id,
                grant_type,
                code: params.code,
                code_verifier,
                redirect_uri: "http://localhost:3000/login/callback",
            };

            console.log("parameters:");
            console.log(parameters);

            const token_endpoint = client.issuer.metadata.token_endpoint || "";
            console.log("token_endpoint:", token_endpoint)
            console.log("parameters:", parameters)

            const tokenSet = await fetch(token_endpoint, {
                method: "post",
                body: new URLSearchParams(parameters),
            });

            if (!tokenSet.ok) {
                const error = new Error(`Status ${tokenSet.status} ${tokenSet.statusText}`)
                console.error("ERROR: Couldn't fetch token:", error);
                console.log(await tokenSet.json()); // prints out error info
                res.redirect("/");
            } else {
                const tokens = await tokenSet.json();
                console.log('received and validated tokens %j', tokens);
                res.cookie("access_token", tokens.access_token, { signed: true });
                res.json(tokens);
            }
        }

    });

    app.get('/logout', (req, res) => {
        res.redirect(client.endSessionUrl());
    });

    app.get('/logout/callback', (req, res) => {
        res.redirect('/');
    });

    // catch 404 and forward to error handler
    app.use(function(req, res, next) {
        next(createError(404));
    });

    // error handler
    const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
        console.log("Error handler called.");
        res.locals.error =  err ? err : { // req.app.get('env') === 'development' &&
            error: getDefaultErr()
        };

        handleErrorLogging(req, err);

        if (res.headersSent) {
            return next(err)
        }

        // render the error page
        res.status(err.status || 500);
        res.render('error');
    };

    app.use(errorHandler);

})

function handleErrorLogging(req: Request, err?: any) {
    if (req.app.get('env') === 'development' || process.env.NODE_ENV === 'development') {
        console.error("ERROR: ", err);
    }
}

function getDefaultErr(errorStr?: string) {
    return {
        message: errorStr ? errorStr : "Internal server error.",
        status: 500,
        stack: []
    };
}

export default {
    startServer: () => app.listen(port, () => {
        console.log(`Started on http://localhost:${port}`);
    })
}
