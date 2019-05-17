import JSZip = require("jszip");
import Log from "../Util";
import {InsightError} from "./IInsightFacade";
const parse5 = require("parse5");
const http = require("http");

export default class RoomsDatasetHandler {

    public static getAllRoomsData (id: string, content: string) {
        return new Promise((resolveRoomsData, reject) => {
            let jszip = new JSZip();
            jszip.loadAsync(content, {base64: true})
                .then((zip: JSZip) => {
                    let index = zip.file(/index.htm/)[0].async("text");
                    return Promise.resolve(index).then((indexData) => indexData);
                }).then((indexData) => {
                    const document = parse5.parse(indexData);
                    let buildings = this.getBuildingsFromIndex(document);
                    let data: any = [];
                    let counter = 0;
                    for (let building of buildings) {
                        let matches = jszip.file(new RegExp(building.href.substr(1, building.href.length)));
                        if (matches.length > 0) {
                            let buildingFile = matches[0];
                            buildingFile.async("text").then((buildingHtml) => {
                                this.getLatLon(building.address).then((latlon: any[]) => {
                                    const buildingObject = parse5.parse(buildingHtml);
                                    let rooms: any = this.getRooms(this.getAllNodes(buildingObject));
                                    for (let room of rooms) {
                                        let roomObject = this.getRoomObject(building, room, latlon);
                                        data.push(roomObject);
                                    }
                                    counter++;
                                    if (counter === buildings.length) {
                                        data.length > 0 ? resolveRoomsData(data) :
                                            reject(new InsightError("No room data"));
                                    }
                                });
                            }).catch((e) => {
                                Log.warn(e);
                                counter++;
                                if (counter === buildings.length) {
                                    data.length > 0 ? resolveRoomsData(data) :
                                        reject(new InsightError("No room data"));
                                }
                            });
                        } else {
                            counter++;
                            if (counter === buildings.length) {
                                data.length > 0 ? resolveRoomsData(data) :
                                    reject(new InsightError("No room data"));
                            }
                        }
                    }
            });
        });
    }

    private static getBuildingsFromIndex (index: object) {
        let nodes = this.getAllNodes(index);
        let buildings = [];
        for (let node of nodes) {
            if (node["nodeName"] === "tbody") {
                for (let child of node["childNodes"]) {
                    if (child["nodeName"] === "tr") {
                        let fullName = this.getFullNameFromIndex(child);
                        let shortName = this.getShortNameFromIndex(child);
                        let address = this.getAddressFromIndex(child);
                        let href = this.getBuildingHrefFromIndex(child);
                        buildings.push({
                            fullName: fullName,
                            shortName: shortName,
                            address: address,
                            href: href
                        });
                    }
                }
            }
        }
        return buildings;
    }

    private static getFullNameFromIndex (node: object) {
        let nodes = this.getAllNodes(node);
        for (let child of nodes) {
            if (child["nodeName"] === "#text") {
                let parent = child["parentNode"];
                let grandParent = parent["parentNode"];
                for (let attr of grandParent["attrs"]) {
                    if (attr.value === "views-field views-field-title") {
                       // return child.value.replace("\n", "").replace("\t", "").replace("\r", "").trim();
                       return this.formatString(child.value);
                    }
                }
            }
        }
        return "";
    }

    private static getShortNameFromIndex (node: object) {
        let nodes = this.getAllNodes(node);
        for (let child of nodes) {
            if (child["nodeName"] === "#text") {
                let parent = child["parentNode"];
                for (let attr of parent["attrs"]) {
                    if (attr.value === "views-field views-field-field-building-code") {
                        // return child.value.replace("\n", "").replace("\t", "").replace("\r", "").trim();
                        return this.formatString(child.value);
                    }
                }
            }
        }
        return "";
    }

    private static getAddressFromIndex (node: object) {
        let nodes = this.getAllNodes(node);
        for (let child of nodes) {
            if (child["nodeName"] === "#text") {
                let parent = child["parentNode"];
                for (let attr of parent["attrs"]) {
                    if (attr.value === "views-field views-field-field-building-address") {
                        // return child.value.replace("\n", "").replace("\t", "").replace("\r", "").trim();
                        return this.formatString(child.value);
                    }
                }
            }
        }
        return "";
    }

    private static getBuildingHrefFromIndex (node: object) {
        let nodes = this.getAllNodes(node);
        for (let child of nodes) {
            if (child["nodeName"] === "a") {
                for (let attr of child["attrs"]) {
                    if (attr.name === "href") {
                        return attr.value;
                    }
                }
            }
        }
        return "";
    }

    private static getRoomObject (building: any, room: any, latlon: any) {
        return {
            rooms_fullname: building.fullName,
            rooms_shortname: building.shortName,
            rooms_number: room["roomNumber"],
            rooms_name: building.shortName + "_" + room["roomNumber"],
            rooms_address: building.address,
            rooms_lat: latlon[0],
            rooms_lon: latlon[1],
            rooms_seats: room["roomCapacity"],
            rooms_type: room["roomType"],
            rooms_furniture: room["roomFurniture"],
            rooms_href: room["roomHref"]
        };
    }

    private static getLatLon (address: string) {
        return new Promise((resolveLatLon, reject) => {
            http.get("http://cs310.ugrad.cs.ubc.ca:11316/api/v1/project_l4l0b_v6x0b/" +
                address.split(" ").join("%20"), (resp: any) => {
                let data = "";
                resp.on("data", (chunk: any) => {
                    data += chunk;
                });
                resp.on("end", () => {
                    if (!JSON.parse(data).error) {
                        let lat = JSON.parse(data).lat;
                        let lon = JSON.parse(data).lon;
                        resolveLatLon([lat, lon]);
                    } else {
                        reject("Error getting lat/lon for address: " + address);
                    }
                });
            });
        });
    }

    private static getRooms (allNodes: any[]) {
        let rooms: object[] = [];

        for (let node of allNodes) {
            if (node["nodeName"] === "tbody") {
                node["childNodes"].forEach((child: any) => {
                    if (child["nodeName"] === "tr") {
                        let roomData = this.getRoomData(child);
                        rooms.push(roomData);
                    }
                });
            }
        }
        return rooms;
    }

    private static getRoomData (node: any) {
        let nodes = this.getAllNodes(node);
        let roomNumber = "";
        let roomCapacity = -1;
        let roomFurniture = "";
        let roomType = "";
        let roomHref = "";

        for (let child of nodes) {
            if (child["nodeName"] === "#text") {
                for (let attr of child["parentNode"]["attrs"]) {
                    if (attr.value === "Room Details") {
                        roomNumber = this.formatString(child.value);
                    }

                    if (attr.value === "views-field views-field-field-room-capacity") {
                        roomCapacity = parseInt(this.formatString(child.value), 10);
                    }

                    if (attr.value === "views-field views-field-field-room-furniture") {
                        roomFurniture = this.formatString(child.value);
                    }

                    if (attr.value === "views-field views-field-field-room-type") {
                        roomType = this.formatString(child.value);
                    }

                    if (attr.name === "href") {
                        roomHref = attr.value;
                    }
                }
            }
        }
        return {roomNumber: roomNumber, roomCapacity: roomCapacity, roomFurniture: roomFurniture,
            roomType: roomType, roomHref: roomHref};
    }

    private static formatString (detail: string) {
        return detail.replace("\n", "")
            .replace("\t", "")
            .replace("\r", "")
            .trim();
            // .replace(/ +(?= )/g, "");
    }

    private static getAllNodes (node: any): any {
        let nodes: object[] = [];
        if (node["childNodes"]) {
            let children: object[] = node["childNodes"];
            for (let child of children) {
                let grandchildren = this.getAllNodes(child);
                if (grandchildren.length > 0) {
                    for (let grandchild of grandchildren) {
                        if (grandchild.constructor !== Array) {
                            nodes.push(grandchild);
                        }
                    }
                } else {
                    if (grandchildren.constructor !== Array) {
                        nodes.push(grandchildren);
                    }
                }
            }
            nodes.push(node);
            return nodes;
        } else {
            return [node];
        }
    }
}
