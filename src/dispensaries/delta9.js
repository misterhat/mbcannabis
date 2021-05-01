const got = require('got');
const striptags = require('striptags');

const PRODUCTS_URL = 'https://knox2.delta9connect.com/feeds/mb/';

// used in combination with PRODUCTS_URL for inventory of each location
const LOCATIONS = {
    35824928588: 'Unit 2 - 1589 Kenaston Blvd',
    57041061708: '655 - 1615 Regent Ave W',
    57552242508: '3321 Portage Ave',
    17054074704: 'Unit 15 - 1399 McPhillips Street',
    14475624505: '478 River Avenue',
    14475591737: '827 Dakota Street Unit #1'
};

const DEFAULT_STOCK = {};

for (const address of Object.values(LOCATIONS)) {
    DEFAULT_STOCK[address] = 0;
}

// products.json category key
const DRIED_ID = 97419396940;

// these are on most of the descriptions, superfluous
const WARNINGS = [
    new RegExp(
        'REMEMBER:\n' +
            'Always\\s?START\\s?LOW\\s?and\\s?GO\\s?SLOW\\s?when it comes to ' +
            'consuming any form of cannabis\\. The effects of ingested ' +
            'cannabis products are slower-acting and longer-lasting than ' +
            'inhaling\\.\nLearn more at KnowMyLimits\\.ca',
        'i'
    ),
    'REMEMBER:\nCannabis Edibles and Drinkables are slower acting and longer ' +
        'lasting than dried cannabis.'
];

// convert the X-Y% for THC and CBD to an array [low, high]
function parseCannabinoids(cbd) {
    if (!cbd || cbd === '<1%') {
        cbd = [0];
    } else if (cbd.indexOf('-') > -1) {
        const [low, high] = cbd.slice(0, -1).split('-');

        cbd = [
            Number.parseFloat(low, 10) || 0,
            Number.parseFloat(high, 10) || 0
        ];
    } else {
        cbd = [Number.parseFloat(cbd, 10) || 0];
    }

    return cbd;
}

function findProductIndex(products, name) {
    for (const [i, product] of Object.entries(products)) {
        if (product.name === name) {
            return i;
        }
    }

    return -1;
}

async function getWeed() {
    const products = [];

    for (const [id, address] of Object.entries(LOCATIONS)) {
        const res = await got(`${PRODUCTS_URL}/${id}.json`);

        // only select the dried cannabis
        const rawProducts = JSON.parse(res.body)[DRIED_ID];

        for (const rawProduct of rawProducts) {
            const name = rawProduct.title;
            const vendor = rawProduct.vendor;

            let description = striptags(rawProduct.body_html, [], ' ').replace(
                /\s\s+/g,
                '\n'
            );

            for (const warning of WARNINGS) {
                description = description.replace(warning, '');
            }

            description = description.trim();

            const thc = parseCannabinoids(rawProduct.meta_fields.thc_amount);
            const cbd = parseCannabinoids(rawProduct.meta_fields.cbd_amount);

            for (const variant of rawProduct.variants) {
                const index = findProductIndex(products, name);

                if (index < 0) {
                    const weight =
                        (Number.parseFloat(variant.title, 10) || 0) * 1000;

                    const price = Number(variant.price);

                    const stock = { ...DEFAULT_STOCK };
                    stock[address] = variant.inventory_quantity;

                    products.push({
                        name,
                        vendor,
                        description,
                        thc,
                        cbd,
                        weight,
                        price,
                        stock
                    });
                } else {
                    products[index].stock[address] = variant.inventory_quantity;
                }
            }
        }
    }

    return products;
}

(async () => {
    console.log(await getWeed());
})();

module.exports.getWeed = getWeed;
