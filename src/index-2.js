import { serve } from "https://deno.land/std@0.155.0/http/server.ts";
import "https://deno.land/std@0.177.0/dotenv/load.ts";


const SUBDOMAIN = (Deno.env.get("SUBDOMAIN") === "true");

const X_FORWARDED_HOST = "x-forwarded-host";

async function patchedReq(req) {
    // Parse & patch URL (preserve path and querystring)
    const url = new URL(req.url);

    const hostParts = url.hostname.split('.')

    const PROJECT_REF = hostParts[0]

    const pathParts = url.pathname.split("/")
    pathParts.shift()

    const FUNCTION_NAME = pathParts.shift()

    if (!SUBDOMAIN)
        url.pathname = '/' + pathParts.join('/')

    const DENO_ORIGIN = SUBDOMAIN
        ? `https://${PROJECT_REF}.deno.dev`
        : `https://${PROJECT_REF}-${FUNCTION_NAME}.deno.dev`

    const denoOrigin = new URL(DENO_ORIGIN);
    url.host = denoOrigin.host;
    url.port = denoOrigin.port;
    url.protocol = denoOrigin.protocol;
    // Patch Headers
    const xHost = url.hostname;

    return [
        url,
        {
            headers: {
                ...Object.fromEntries(req.headers.entries()),
                [X_FORWARDED_HOST]: xHost,
                ['x-tictapp-ref']: PROJECT_REF,
                ['x-tictapp-fun']: FUNCTION_NAME
            },
            body: req.body,
            method: req.method,
        },
    ];
}

async function relayTo(req) {
    const [url, init] = await patchedReq(req);
    console.log('relayTo', req.url, url, init)
    return await fetch(url, init);
}

serve((req) => {
    const url = new URL(req.url);

    if (url.pathname.length > 1 || SUBDOMAIN)
        return relayTo(req)


    return new Response(JSON.stringify({
        error: `Invalid URL. Required: https://{project_ref}.tictapp.dev/{function_name}`,
        url
    }, null, 4), {
        status: 400
    });
})
