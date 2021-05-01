const got = require('got');
const promiseLimit = require('promise-limit');
const striptags = require('striptags');

const HOME_URL = 'https://thejointcannabis.ca';
const PRODUCTS_URL =
    `${HOME_URL}/collections/flower-mb/products.json?limit=500`;

const STOCK_URL =
    'https://inventorylocations.checkmyapp.net/variant/' +
    'thejointcannabis.myshopify.com/$variant/farts';

/*async function getLocations() {
    const res = await got(HOME_URL);
    const body = res.body;
    const $ = cheerio.load(body);
    const rawLocations = JSON.parse($('#bms-store-locations').html());
}*/

const limit = promiseLimit(4);

async function parseProducts(rawProduct) {
    const variants = [];

    const vendor = rawProduct.vendor;

    const name = rawProduct.title
        .replace('Dried Cannabis - MB - ', '')
        .replace(' Flower - Grams:', '')
        .replace(' Flower - Format:', '')
        .replace(rawProduct.vendor, '')
        .trim();

    const description = striptags(rawProduct.body_html, [], ' ')
        .replace(/\s\s+/g, '\n')
        .trim();

    const thc = [];

    const thcMatch = description.match(
        /thc:\s?(\d+\.\d+)\s?.\s?(\d+\.\d+)?/i
    );

    if (thcMatch) {
        thc.push(Number(thcMatch[1]) || 0);

        if (thcMatch[2]) {
            thc.push(Number(thcMatch[2]) || 0);
        }
    }

    const cbd = [];

    const cbdMatch = description.match(
        /cbd:\s?(\d+\.\d+)\s?.\s?(\d+\.\d+)?/i
    );

    if (cbdMatch) {
        cbd.push(Number(cbdMatch[1]) || 0);

        if (cbdMatch[2]) {
            cbd.push(Number(cbdMatch[2]) || 0);
        }
    }

    for (const variant of rawProduct.variants) {
        const weight = Number.parseFloat(variant.title, 10) * 1000;
        const price = Number(variant.price);

        const stockURL = STOCK_URL.replace('$variant', variant.id);
        const res = await got(stockURL);
        const rawStock = JSON.parse(res.body).product.variants[variant.id];

        if (!rawStock) {
            continue;
        }

        const rawLocations = rawStock.inventoryItem.locations.filter(
            ({ name }) => /manitoba/i.test(name)
        );

        const stock = {};

        for (const loc of rawLocations) {
            stock[loc.address] = loc.q;
        }

        variants.push({
            name,
            vendor,
            description,
            thc,
            cbd,
            weight,
            price,
            stock
        });
    }

    return variants;
}

async function getWeed() {
    const res = await got(PRODUCTS_URL);
    const rawProducts = JSON.parse(res.body).products;

    const products = (await Promise.all(rawProducts.map((rawProduct) => {
        return limit(() => parseProducts(rawProduct));
    }))).flat();

    return products;
}

(async () => {
    console.log(await getWeed());
})();

module.exports.getWeed = getWeed;
