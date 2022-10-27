import type { Handler } from "@netlify/functions";

// TODO: Typecheck all of these Netlify functions
const handler: Handler = async (event, context) => {
  // TODO: Send to Sentry
  console.log("event.body", event.body);
  console.log("context", context);
  return {
    statusCode: 200,
    body: "",
  };
};

export { handler };
