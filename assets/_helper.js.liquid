const LiquifyHelper = {
    /**
     * Format a monetary value with the currency-format set in Shopify backend.
     *
     * @int value
     * @bool minor Optional, defaults to true.
     * @string shopMoneyFormat Shop-Setting, via Liquid: shop.money_with_currency_format
     */
    moneyFormat: (value, isMinor = true, shopMoneyFormat = '') => {
        let floatValue = parseFloat(value);

        if (isNaN(floatValue)) {
            return '';
        }

        floatValue = isMinor
            ? floatValue / 100
            : floatValue;

        let formattedValue = '';
        const match = shopMoneyFormat.match(/\{\{\s*(\w+)\s*\}\}/);
        const formatType = match ? match[1] : null;

        switch (formatType) {
            case 'amount':
                formattedValue = floatValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                break;
            case 'amount_no_decimals':
                formattedValue = Math.round(floatValue).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                break;
            case 'amount_with_comma_separator':
                formattedValue = floatValue.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                break;
            default:
                console.log('Error in moneyFormat. Unknown format type or none provided: ' + formatType);

                const formatter = new Intl.NumberFormat(Shopify.locale + '-' + Shopify.country, {
                    style: 'currency',
                    currency: Shopify.currency.active,
                });

                value = isMinor ? value / 100 : value;

                return formatter.format(value);
        }

        return shopMoneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/g, formattedValue);
    },

    htmlspecialchars_decode(string) {
        let tempElement = document.createElement('textarea');
        tempElement.innerHTML = string;
        return tempElement.value;
    },

    triggerClick: function (el) {
        if(!(el instanceof HTMLElement)) {
            console.info(el + ' must be an instance of HTMLElement')
            return
        }
        const ev = new KeyboardEvent("keydown",{
            code: 'Enter',
            key: 'Enter',
            charCode: 13,
            keyCode: 13,
            view: window,
            bubbles: true
        });

        el.dispatchEvent(ev);
    },

    /**
     * Trigger dropdown click to open minicart
     */
    handleTriggerClick: function () {
        let elements = document.querySelectorAll('[li-element="mini-cart-toggle"]');
        elements.forEach(element => {
            let closestDropdown = element.closest('.w-dropdown-toggle');
            if (closestDropdown) {
                this.triggerClick(closestDropdown);
            } else {
                console.error('(helper.js) No dropdown found for minicart trigger');
            }
        });
    },

    triggerClickById: (id) => {
        const el = document.getElementById(id)
        LiquifyHelper.triggerClick(el)
    },

    triggerClickByClass: (className) => {
        const elList = document.getElementsByClassName(className)
        for (const el of elList) {
            LiquifyHelper.triggerClick(el)
        }
    },

    serializeFormToObject: (form) => {
        const obj = {};
        try {
            const formData = new FormData(form);
            const properties = {};
            for (const [key, value] of formData) {
                if(key.indexOf('properties') !== -1) {
                    const name = key.replace('properties[', '').replace(']', '');
                    properties[name] = value;
                    obj["properties"] = properties;
                } else {
                    obj[key] = value;
                }
            }
        } catch(e) {
            console.info("form not found", form)
        }
        return obj ;
    },
};
