import {
  Application,
  Request,
  Status,
  Context,
} from "https://deno.land/x/oak@v10.3.0/mod.ts";
import * as jose from "https://deno.land/x/jose@v4.3.7/index.ts";
//import { load } from "https://deno.land/std/dotenv/mod.ts";
import "https://deno.land/std@0.177.0/dotenv/load.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const env = {}

const app = new Application();


const X_FORWARDED_HOST = "x-forwarded-host";

const PROJECT_REF =
  Deno.env.get("PROJECT_REF") ?? env.PROJECT_REF;

const JWT_SECRET =
  Deno.env.get("JWT_SECRET") ?? env.JWT_SECRET;
// const DENO_ORIGIN =
//   Deno.env.get("DENO_ORIGIN") ?? env.DENO_ORIGIN;
const VERIFY_JWT =
  (Deno.env.get("VERIFY_JWT") ?? env.VERIFY_JWT) === "true";



const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
//const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// const DENO_ORIGIN = `https://tictapp-${PROJECT_REF}`
  
function getAuthToken(ctx: Context) {
  const authHeader = ctx.request.headers.get("authorization");
  if (!authHeader) {
    ctx.throw(Status.Unauthorized, "Missing authorization header");
  }
  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer") {
    ctx.throw(Status.Unauthorized, `Auth header is not 'Bearer {token}'`);
  }
  return token;
}

async function verifyJWT(jwt: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(JWT_SECRET);
  try {
    await jose.jwtVerify(jwt, secretKey);
  } catch (err) {
    console.error(err);
    return false;
  }
  return true;
}

function sanitizeHeaders(headers: Headers): Headers {
  const sanitizedHeaders = new Headers();
  const headerDenyList = ["set-cookie"];

  headers.forEach((value, key) => {
    if (!headerDenyList.includes(key.toLowerCase())) {
      sanitizedHeaders.set(key, value);
    }
  });
  return sanitizedHeaders;
}

function patchedReq(req: Request): [URL, RequestInit] {
  // Parse & patch URL (preserve path and querystring)
  const url = req.url;
  const pathParts = url.pathname.split("/")
  pathParts.shift()
  const FUNCTION_NAME = pathParts.shift()

  console.log('pathParts', pathParts)
  url.pathname = '/' + pathParts.join('/')

  const DENO_ORIGIN = `https://ttf-${FUNCTION_NAME}.deno.dev`

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
      },
      body: (req.hasBody
        ? req.body({ type: "stream" }).value
        : undefined) as unknown as BodyInit,
      method: req.method,
    },
  ];
}

async function relayTo(req: Request): Promise<Response> {
  const [url, init] = patchedReq(req);
  console.log('RELAY', url, init)
  return await fetch(url, init);
}

app.use(async (ctx: Context, next: () => Promise<unknown>) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
    ctx.response.body = err.message;
    ctx.response.headers.append("x-relay-error", "true");
    ctx.response.status = err.status || 500;
  }
});

app.use(async (ctx: Context, next: () => Promise<unknown>) => {
  const { request, response } = ctx;

  if (request.url.pathname === '/favicon.ico') {
    return ctx.throw(Status.NotFound, `Not Found`)
  }

  const supportedVerbs = ['POST', 'GET','PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  if (!(supportedVerbs.includes(request.method))) {
    console.error(`${request.method} not supported`);
    return ctx.throw(
      Status.MethodNotAllowed,
      `HTTP request method not supported (supported: ${supportedVerbs.join(' ')})`
    );
  }

  const url = request.url;
  const pathParts = url.pathname.split("/")
  pathParts.shift()
  const FUNCTION_NAME = pathParts.shift()
  if (!FUNCTION_NAME) {
    return ctx.throw(Status.NotFound, `Function name required`)
  }


  const {data,error} = await supabase.from('functions').select('*').eq('name', FUNCTION_NAME)
  const fun = data[0]

  if (data.length === 0) {
    return ctx.throw(Status.NotImplemented, `Function "${PROJECT_REF}/${FUNCTION_NAME}" not found`)
  }

  if (error) {
    return ctx.throw(Status.BadRequest, `${error}`)
  }

  console.log('[function]', fun)

  const VERIFY_JWT = fun.verify_jwt  //Deno.env.get(`FUNCTION_${FUNCTION_NAME?.toUpperCase()}_VERIFY_JWT`) === "true"

  if (request.method !== "OPTIONS" && VERIFY_JWT) {
    const token = getAuthToken(ctx);
    const isValidJWT = await verifyJWT(token);

    if (!isValidJWT) {
      return ctx.throw(Status.Unauthorized, "Invalid JWT");
    }
  }

  const resp = await relayTo(request);

  const sanitizedHeaders = sanitizeHeaders(resp.headers);
  if (request.method === "GET") {
    const contentTypeHeader = sanitizedHeaders.get('Content-Type');
    // if (contentTypeHeader?.includes('text/html')) {
    //   sanitizedHeaders.set('Content-Type', 'text/plain');
    // }
  }

  response.body = resp.body;
  response.status = resp.status;
  response.headers = sanitizedHeaders;
  response.type = resp.type;

  await next();
});

if (import.meta.main) {
  const port = parseInt(Deno.args?.[0] ?? 8081);
  const hostname = "0.0.0.0";

    console.log(`[deno-relay][${PROJECT_REF}] 2`)

  console.log(`Listening on http://${hostname}:${port} -> ${PROJECT_REF}`);
  await app.listen({ port, hostname });
}


// deno run --watch --allow-all src/index.ts