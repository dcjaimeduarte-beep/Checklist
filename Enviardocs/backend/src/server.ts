import { env } from "./config/env";
import app from "./app";

app.listen(env.port, () => {
  console.log(`[Seven Docs] Backend em http://localhost:${env.port} (${env.nodeEnv})`);
});
