import InsightFacade from "../controller/InsightFacade";
import Server from "./Server";
import Log from "../Util";
import restify = require("restify");
import {NotFoundError} from "../controller/IInsightFacade";

export class ServerRoute {
    private readonly insightFacade: InsightFacade;

    constructor() {
        this.insightFacade = new InsightFacade();
    }

    public put (req: restify.Request, res: restify.Response, next: restify.Next) {

        let id = req.params.id;
        let kind = req.params.kind;

        let content;
        try {
            content = new Buffer(req.params.body).toString("base64");
            this.insightFacade.addDataset(id, content, kind)
                .then((response) => {
                    res.send(200, {result: response});
                }).catch((e) => {
                res.send(400, {error: e.message});
            });
        } catch (e) {
            res.send(400, {error: e.message});
        }
    }

    public delete (req: restify.Request, res: restify.Response, next: restify.Next) {

        let id = req.params.id;

        this.insightFacade.removeDataset(id)
            .then((response) => {
                res.send(200, {result: response});
            }).catch((e) => {
                Log.warn(e);
                if (e instanceof NotFoundError) {
                    res.send(404, {error: e.message});
                } else {
                    res.send(400, {error: e.message});
                }
        });
    }

    public postQuery (req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.warn(req.body);
        this.insightFacade.performQuery(req.body).then((response) => {
            res.send(200, {result: response});
        }).catch((e) => {
            res.send(400, {error: e.message});
        });
    }

    public getDatasets (req: restify.Request, res: restify.Response, next: restify.Next) {
        this.insightFacade.listDatasets().then((response) => {
            res.send(200, {result: response});
        });
    }
}
