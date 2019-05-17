/**
 * Receives a query object as parameter and sends it as Ajax request to the POST /query REST endpoint.
 *
 * @param query The query object
 * @returns {Promise} Promise that must be fulfilled if the Ajax request is successful and be rejected otherwise.
 */
CampusExplorer.sendQuery = function(query) {
    return new Promise(function(fulfill, reject) {
        let http = new XMLHttpRequest();
        let url = "http://localhost:4321/query";

        http.open("POST", url, true);

        http.setRequestHeader("Content-Type", "application/json");

        console.log(JSON.stringify(query));

        http.onload = function() {//Call a function when the state changes.
            console.log(http.response);
            if (http.response) {
                CampusExplorer.renderResult(JSON.parse(http.response));
            } else {
                console.warn(http);
            }
        };

        http.send(JSON.stringify(query));
    });
};
