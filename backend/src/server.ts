import "dotenv/config";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const app = buildApp();

app.listen(port, () => {
  console.log(`RastreaEmendas API ouvindo em http://localhost:${port}`);
});
