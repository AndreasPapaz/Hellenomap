import { describe, expect, it } from "vitest";
import { fieldErrors, formDataToInput, submissionSchema, type SubmissionInput } from "@/lib/submission-schema";

const valid: SubmissionInput = {
  name: "  Agora Market ",
  categories: ["market", "deli", "market"],
  address: "2134 N Western Ave, Chicago, IL 60647",
  email: "owner@example.com",
  phone: "(773) 904-3000",
  website: "agoramarketchicago.com",
  description: "",
  ownershipNote: "Owned by the Marinis family",
};

const errorsFor = (input: Partial<SubmissionInput>) => {
  const r = submissionSchema.safeParse({ ...valid, ...input });
  return r.success ? {} : fieldErrors(r.error);
};

describe("submissionSchema", () => {
  it("accepts and normalizes a valid submission", () => {
    expect(submissionSchema.parse(valid)).toEqual({
      name: "Agora Market",
      categories: ["market", "deli"],
      address: "2134 N Western Ave, Chicago, IL 60647",
      email: "owner@example.com",
      phone: "(773) 904-3000",
      website: "https://agoramarketchicago.com/",
      description: null,
      ownershipNote: "Owned by the Marinis family",
    });
  });

  it("treats optional fields as optional", () => {
    const r = submissionSchema.parse({ ...valid, phone: undefined, website: "", description: undefined, ownershipNote: "" });
    expect(r).toMatchObject({ phone: null, website: null, description: null, ownershipNote: null });
  });

  it.each<[string, Partial<SubmissionInput>, string, string]>([
    ["missing name", { name: "  " }, "name", "Business name is required"],
    ["missing address", { address: "" }, "address", "Address is required"],
    ["no categories", { categories: [] }, "categories", "Choose at least one category"],
    ["too many categories", { categories: ["a", "b", "c", "d", "e", "f"] }, "categories", "Choose at most 5 categories"],
    ["bad category slug", { categories: ["<x>"] }, "categories", "Invalid category"],
    ["missing email", { email: "" }, "email", "Your email is required"],
    ["bad email", { email: "nope" }, "email", "Enter a valid email address"],
    ["bad website", { website: "not a url" }, "website", "Enter a valid website address, like example.com"],
    ["javascript url", { website: "javascript:alert(1)" }, "website", "Enter a valid website address, like example.com"],
    ["bad phone", { phone: "call me" }, "phone", "Enter a valid phone number"],
    ["short phone", { phone: "12345" }, "phone", "Enter a valid phone number"],
    ["long description", { description: "x".repeat(2001) }, "description", "Must be 2000 characters or fewer"],
    ["long name", { name: "x".repeat(201) }, "name", "Must be 200 characters or fewer"],
  ])("rejects %s", (_, input, field, message) => {
    expect(errorsFor(input)).toMatchObject({ [field]: message });
  });
});

describe("formDataToInput", () => {
  it("reads repeated category fields", () => {
    const fd = new FormData();
    fd.set("name", "X");
    fd.append("categories", "deli");
    fd.append("categories", "bakery");
    expect(formDataToInput(fd)).toMatchObject({ name: "X", categories: ["deli", "bakery"], website: "" });
  });
});
