if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
    const policy = trustedTypes.createPolicy('tampermonkey-fix', {
        createHTML: (input: string) => input,
        createScript: (input: string) => input,
        createScriptURL: (input: string) => input,
    });

    // 修补 innerHTML
    const origInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!;
    Object.defineProperty(Element.prototype, 'innerHTML', {
        get: origInnerHTML.get,
        set: function(val) {
            if (typeof val === 'string') {
                origInnerHTML.set!.call(this, policy.createHTML(val));
            } else {
                origInnerHTML.set!.call(this, val);
            }
        },
        configurable: true,
        enumerable: true,
    });

    // 修补 outerHTML
    const origOuterHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML')!;
    Object.defineProperty(Element.prototype, 'outerHTML', {
        get: origOuterHTML.get,
        set: function(val) {
            if (typeof val === 'string') {
                origOuterHTML.set!.call(this, policy.createHTML(val));
            } else {
                origOuterHTML.set!.call(this, val);
            }
        },
        configurable: true,
        enumerable: true,
    });

    // 修补 insertAdjacentHTML
    const origInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    Element.prototype.insertAdjacentHTML = function(position, text) {
        origInsertAdjacentHTML.call(this, position, policy.createHTML(text));
    };
}
