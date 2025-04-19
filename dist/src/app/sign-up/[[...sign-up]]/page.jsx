"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Page;
const nextjs_1 = require("@clerk/nextjs");
function Page() {
    return (<div className="flex justify-center items-center min-h-screen">
      <nextjs_1.SignUp path="/sign-up"/>
    </div>);
}
