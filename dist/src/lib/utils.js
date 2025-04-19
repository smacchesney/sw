"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = cn;
exports.formatDate = formatDate;
exports.delay = delay;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
/**
 * Formats a date using the Intl.DateTimeFormat API
 * @param date Date to format
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
function formatDate(date, options = {
    month: "long",
    day: "numeric",
    year: "numeric",
}) {
    return new Intl.DateTimeFormat("en-US", options).format(new Date(date));
}
/**
 * Creates a delay using a Promise
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after the specified delay
 */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
