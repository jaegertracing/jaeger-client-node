export default class RateLimiter {

    constructor(creditsPerSecond) {
        this._creditsPerSecond = creditsPerSecond;
        this._balance = creditsPerSecond;
        this._lastTick = new Date().getTime();
    }

    checkCredit(itemCost) {
        let currentTime = new Date().getTime();
        let elapsedTime = (currentTime - this._lastTick) / 1000;
        this.lastTick = currentTime;

        this._balance += elapsedTime * this._creditsPerSecond;
        if (this._balance > this._creditsPerSecond) {
            this._balance = this._creditsPerSecond;
        }

        if (this._balance >= itemCost) {
            this._balance -= itemCost;
            return true;
        }
        return false;
    }
}
