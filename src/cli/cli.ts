import "https://deno.land/std@0.177.0/dotenv/load.ts";
import yargs from 'https://cdn.deno.land/yargs/versions/yargs-v16.2.1-deno/raw/deno.ts';
import * as _ from 'https://deno.land/x/lodash@4.17.15-es/lodash.js';

interface Arguments {
   // from: string;
   // to: string;
   // body: string;
   // sid: string;
   //apikey: string;
   //secret: string;
    //
   project: string;
   apikey: string;
   secret: string;
   name: string;
}

let inputArgs: Arguments = yargs(Deno.args)
   // .alias('f', 'from')
   // .alias('t', 'to')
   // .alias('b', 'body')
   // .alias('i', 'sid')
   //.alias('k', 'apikey')
  // .alias('s', 'secret')
   //
   .alias('p', 'project')
   .alias('k', 'apikey')
   .alias('s', 'secret')
   .alias('n', 'name')
   
   .argv;

let errorMessages: {[k: string]: string} = {
   //from: 'Provide the message sender (From:) value using --from [-f] parameter',
   //to: 'Provide the message receiver (To:) value using --to [-t] parameter',
   //body: 'Provide the message body value using --body [-b] parameter',
   //apikey: 'Provide your Twilio API key SID using --apikey [-k] parameter',
   //sid: 'Provide your Twilio account SID using --sid [-i] parameter',
   //secret: 'Provide your Twilio API key secret using --secret [-s] parameter',
    //
   project: 'Provide your project endpoint using --project [-p] parameter',
   apikey: 'Provice your project anon key using --apikey [-k] parameter',
   secret: 'Provice your project service role key using --secret [-s] parameter',

   name: 'Provice your function name using --name [-n] parameter',

};

inputArgs = _.defaults(inputArgs, {
   //sid: Deno.env.get('TWILIO_ACCOUNT_SID'),
   //apikey: Deno.env.get('TWILIO_API_KEY'),
   //secret: Deno.env.get('TWILIO_API_SECRET'),
   //from: Deno.env.get('TWILIO_PHONE_NUMBER'),
    //
    project: Deno.env.get('SUPABASE_URL'),
    apikey: Deno.env.get('SUPABASE_ANON_KEY'),
    secret: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),

});
inputArgs = <any> _.pickBy(inputArgs, _.identity);


let errors: string[] = _.difference(_.keys(errorMessages), _.keys(inputArgs));


if (errors.length > 0) {
   errors.forEach(error => console.log(errorMessages[error]));
   console.log('Proper program usage is:');
   console.log (`deno run --allow-env --allow-read --allow-net cli.ts --name hello-world`)
   Deno.exit(1)
}


console.log(`inputArgs`, inputArgs)
const sbUrl = new URL(Deno.env.get('SUPABASE_URL'))
const ref = sbUrl.hostname.split(".").shift()

const token = Deno.env.get('TOKEN')
const payload = {
   name: inputArgs.name
}

const options = {
   method: 'POST',
   headers: {
       Authorization: `Bearer ${token}`,
       'Content-Type': 'application/json'
   },
   body: JSON.stringify(payload)
};

const res = await fetch(`https://api.tictapp.studio/admin/projects/${ref}/functions`, options)

const curlCmd = (fun) => `
curl -L -X POST 'https://${fun.project.ref}.functions.tictapp.io/${fun.name}' -H 'Authorization: Bearer ${fun.project.anon_key}' --data '{"name":"Functions"}'`

if (res.ok) {
   const data = await res.json()
   const cmd = curlCmd(data)
   console.log(data)
   console.log(`Authorization enabled: ${data.verify_jwt}`)
   console.log("\n\nInvoke your function\n")
   console.log(cmd)
   console.log("\n\n")
} else {
   const data = await res.json()
   console.error(`\n\nError:\n`)
   if (data.message) {
   console.error(data.code, data.message)
    }  else {
   console.error(data)
    }
}

// deployctl deploy --project=hello-world --token=ddp_ebahKKeZqiZVeOad7KJRHskLeP79Lf0OJXlj ./hi3/index.ts
// deployctl deploy --project=ttf-hi6 --token=ddp_ebahKKeZqiZVeOad7KJRHskLeP79Lf0OJXlj --prod ./index.js
// deployctl logs --project=ttf-hi6 --token=ddp_ebahKKeZqiZVeOad7KJRHskLeP79Lf0OJXlj
// const message: SMSRequest = {
//    From: inputArgs.from,
//    To: inputArgs.to,
//    Body: inputArgs.body,
// };


// const helper = new TwilioSMS(inputArgs.sid, inputArgs.apikey, inputArgs.secret);

// helper.sendSms(message).subscribe(console.log);
