const jsdom = require("jsdom")
const axios = require("axios")
const fs = require('fs/promises')
const path = require('path')

function delay(t, v) {
   return new Promise(function(resolve) {
       setTimeout(resolve.bind(null, v), t)
   });
}

Promise.prototype.delay = function(t) {
    return this.then(function(v) {
        return delay(t, v);
    });
}

const MetCap = function() {
    this.host = "https://www.metcap.com"
    this.searchURL = this.host + "/province-search-results?lang=en&province=117&cities=Vancouver&beds=&price_from=&price_to="

    this.searchIO = extractDocument

    this.searchExtractor = data => {
        const html = new jsdom.JSDOM(data)
        return Array.from(html.window.document.querySelectorAll('div.province-results__content>h2>a[href]').values()).map(a => this.host + a.getAttribute('href'))
    }

    this.resultExtractor = (data, url) => {
        const html = new jsdom.JSDOM(data)
        const result = html.window.document.querySelector('div.listing-content > table.table-listing')
        if (result != null) {
            return result.outerHTML + '<a href=' + url + '>Link</a>'
        }
        else {
            return null
        }
    }
}

const Tribe = function() {
    this.host = "https://www.triberentals.com"
    this.searchURL = path.resolve(__dirname, "tribe.json")
    
    this.searchIO = (url, extractor) => {
        return fs.readFile(url).then(data => {
            return extractor(data, url)
        })
    }

    this.searchExtractor = data => {
        return JSON.parse(data)
    }

    this.resultExtractor = (data, url) => {
        const html = new jsdom.JSDOM(data)
        const result = html.window.document.querySelector('div.widget.suites')
        if (result != null && result.querySelector('div.no-suites') == null) {
            result.querySelectorAll('div.modal.fade')?.forEach(r => r.remove())
            result.querySelectorAll('div.suite-description-container')?.forEach(r => r.remove())
            result.querySelectorAll('div.table-body-virtual-tours')?.forEach(r => r.remove())
            return result.outerHTML + '<a href=' + url + '>Link</a>'
        }
        else {
            return null
        }
    }
}

const CLV = function() {
    this.host = "https://www.clvgroup.com"
    this.searchURL = path.resolve(__dirname, "clv.json")
    
    this.searchIO = (url, extractor) => {
        return fs.readFile(url).then(data => {
            return extractor(data, url)
        })
    }

    this.searchExtractor = data => {
        return JSON.parse(data)
    }

    this.resultExtractor = (data, url) => {
        const html = new jsdom.JSDOM(data)
        const result = html.window.document.querySelector('section.widget.suites')
        if (result != null && result.querySelector('div.unavailable') == null) {
            result.querySelectorAll('div.suite-tour')?.forEach(r => r.remove())
            result.querySelectorAll('div.suite-footer')?.forEach(r => r.remove())
            return result.outerHTML + '<a href=' + url + '>Link</a>'
        }
        else {
            return null
        }
    }
}

function extractDocument(url, extractor, i) {
    return delay(100 * i, null).then($ => {
        return axios.get(url, {headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15' }})
        .then(resp =>{
            return extractor(resp.data, url)
        })
        .catch(e => {
            console.error("Failed sending request to " + url + " Error:" + e)
            throw e
        })
    })
}

function doOne(obj) {
    return obj.searchIO(obj.searchURL, obj.searchExtractor)
        .then(searchResults => {
            return Promise.all(searchResults.map((searchResult, i) => {
                return extractDocument(searchResult, obj.resultExtractor, i)
            }))
        })
        .then(result => result.join(''))
}

Promise.all([
    doOne(new MetCap()),
    doOne(new Tribe()),
    doOne(new CLV())
])
    .then(content => {
        //console.log(content)
        fs.writeFile('rental.html', content.join(''))
    })

