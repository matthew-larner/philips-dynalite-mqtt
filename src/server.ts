import * as express from 'express';
import { Express, Request, Response } from 'express';
import * as bodyParser from 'body-parser';

/**
 * Bootstrap
 */
const server = (port?: number): Express => {

  const prefix = '';
  const app = express();

  app.use(bodyParser.json());

  app.get(`${prefix}/`, (req: Request, res: Response) => {
    res.status(200).send({
      mqtt: process.env.mqtt,
      dynalite: process.env.dynalite
    });
  });

  app.listen(port, () => console.info('App is now running.'));

  return app;
};

export default server;
