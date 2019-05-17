/* tslint:disable:no-console */

/**
 * Collection of logging methods. Useful for making the output easier to read and understand.
 */
export default class Log {
    public static trace(msg: string): void {
        console.log(`<T> ${new Date().toLocaleString()}: ${msg}`);
    }

    public static info(msg: string): void {
        console.info(`<I> ${new Date().toLocaleString()}: ${msg}`);
    }

    public static warn(msg: string): void {
        console.warn(`<W> ${new Date().toLocaleString()}: ${msg}`);
    }

    public static error(msg: string): void {
        console.error(`<E> ${new Date().toLocaleString()}: ${msg}`);
    }

    public static test(msg: string): void {
        console.log(`<X> ${new Date().toLocaleString()}: ${msg}`);
    }
}
