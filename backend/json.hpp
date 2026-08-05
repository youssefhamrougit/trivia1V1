// ============================================================================
//  json.hpp — a tiny JSON parser/serializer for the C++ backend.
//  No dependencies, ~250 lines. Good enough for Supabase's REST API.
// ============================================================================
#pragma once

#include <string>
#include <vector>
#include <map>
#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <stdexcept>

namespace jx {

struct Value;                              // forward declaration
inline std::string dump(const Value& v);    // so struct helpers can call it

struct Value {
  enum Type { Null, Bool, Num, Str, Arr, Obj };
  Type type = Null;
  bool b = false;
  double n = 0;
  std::string s;
  std::vector<Value> a;
  std::map<std::string, Value> o;

  Value() {}
  static Value mkNull() { return Value(); }
  static Value mkBool(bool v) { Value x; x.type = Bool; x.b = v; return x; }
  static Value mkNum(double v) { Value x; x.type = Num; x.n = v; return x; }
  static Value mkStr(const std::string& v) { Value x; x.type = Str; x.s = v; return x; }
  static Value mkArr() { Value x; x.type = Arr; return x; }
  static Value mkObj() { Value x; x.type = Obj; return x; }

  bool isNull() const { return type == Null; }
  bool isArr() const { return type == Arr; }
  bool isObj() const { return type == Obj; }
  bool isStr() const { return type == Str; }

  bool has(const std::string& key) const { return o.count(key) > 0; }
  const Value* get(const std::string& key) const {
    auto it = o.find(key);
    return it == o.end() ? nullptr : &it->second;
  }

  // "any value -> string" getter (for reading fields from API responses)
  std::string str(const std::string& key, const std::string& dflt = "") const {
    const Value* v = get(key);
    if (!v || v->isNull()) return dflt;
    if (v->isStr()) return v->s;
    if (v->type == Num) { char buf[64]; snprintf(buf, sizeof buf, "%g", v->n); return buf; }
    if (v->type == Bool) return v->b ? "true" : "false";
    return dump(*v);
  }
  double num(const std::string& key, double dflt = 0) const {
    const Value* v = get(key);
    if (!v || v->type != Num) return dflt;
    return v->n;
  }
  bool boolean(const std::string& key, bool dflt = false) const {
    const Value* v = get(key);
    if (!v || v->type != Bool) return dflt;
    return v->b;
  }
};

// ============================================================================
//  parser (recursive descent)
// ============================================================================
namespace detail {
struct Parser {
  const std::string& s;
  size_t i = 0;
  explicit Parser(const std::string& str) : s(str) {}

  void ws() {
    while (i < s.size() && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++;
  }
  char peek() { return i < s.size() ? s[i] : '\0'; }
  bool eat(char c) { ws(); if (peek() == c) { i++; return true; } return false; }

  Value parseValue() {
    ws();
    char c = peek();
    if (c == '{') return parseObject();
    if (c == '[') return parseArray();
    if (c == '"') return Value::mkStr(parseString());
    if (c == 't' && s.compare(i, 4, "true") == 0) { i += 4; return Value::mkBool(true); }
    if (c == 'f' && s.compare(i, 5, "false") == 0) { i += 5; return Value::mkBool(false); }
    if (c == 'n' && s.compare(i, 4, "null") == 0) { i += 4; return Value(); }
    return parseNumber();
  }

  std::string parseString() {
    if (peek() != '"') throw std::runtime_error("json: expected string");
    i++;
    std::string out;
    while (i < s.size()) {
      char c = s[i++];
      if (c == '"') return out;
      if (c == '\\') {
        if (i >= s.size()) break;
        char e = s[i++];
        switch (e) {
          case '"': out += '"'; break;
          case '\\': out += '\\'; break;
          case '/': out += '/'; break;
          case 'b': out += '\b'; break;
          case 'f': out += '\f'; break;
          case 'n': out += '\n'; break;
          case 'r': out += '\r'; break;
          case 't': out += '\t'; break;
          case 'u': {
            // \uXXXX -> utf-8 (basic multilingual plane is enough for us)
            unsigned cp = 0;
            for (int k = 0; k < 4 && i < s.size(); k++) {
              char h = s[i++];
              cp <<= 4;
              if (h >= '0' && h <= '9') cp |= (unsigned)(h - '0');
              else if (h >= 'a' && h <= 'f') cp |= (unsigned)(h - 'a' + 10);
              else if (h >= 'A' && h <= 'F') cp |= (unsigned)(h - 'A' + 10);
            }
            if (cp < 0x80) out += (char)cp;
            else if (cp < 0x800) {
              out += (char)(0xC0 | (cp >> 6));
              out += (char)(0x80 | (cp & 0x3F));
            } else {
              out += (char)(0xE0 | (cp >> 12));
              out += (char)(0x80 | ((cp >> 6) & 0x3F));
              out += (char)(0x80 | (cp & 0x3F));
            }
            break;
          }
          default: out += e;
        }
      } else out += c;
    }
    throw std::runtime_error("json: unterminated string");
  }

  Value parseNumber() {
    size_t start = i;
    if (peek() == '-') i++;
    while (i < s.size() && (std::isdigit((unsigned char)s[i]) || s[i] == '.' ||
                            s[i] == 'e' || s[i] == 'E' || s[i] == '+' || s[i] == '-')) i++;
    return Value::mkNum(atof(s.substr(start, i - start).c_str()));
  }

  Value parseObject() {
    Value obj = Value::mkObj();
    i++; // '{'
    ws();
    if (peek() == '}') { i++; return obj; }
    while (i < s.size()) {
      std::string key = parseString();
      if (!eat(':')) throw std::runtime_error("json: missing ':'");
      obj.o[key] = parseValue();
      ws();
      if (peek() == ',') { i++; continue; }
      if (peek() == '}') { i++; break; }
      throw std::runtime_error("json: bad object");
    }
    return obj;
  }

  Value parseArray() {
    Value arr = Value::mkArr();
    i++; // '['
    ws();
    if (peek() == ']') { i++; return arr; }
    while (i < s.size()) {
      arr.a.push_back(parseValue());
      ws();
      if (peek() == ',') { i++; continue; }
      if (peek() == ']') { i++; break; }
      throw std::runtime_error("json: bad array");
    }
    return arr;
  }
};
} // namespace detail

inline Value parse(const std::string& text) {
  detail::Parser p(text);
  return p.parseValue();
}

// ============================================================================
//  serializer
// ============================================================================
inline std::string esc(const std::string& s) {
  std::string out = "\"";
  for (char c : s) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if ((unsigned char)c < 0x20) {
          char buf[8];
          snprintf(buf, sizeof buf, "\\u%04x", (unsigned char)c);
          out += buf;
        } else out += c;
    }
  }
  return out + "\"";
}

inline std::string dump(const Value& v) {
  switch (v.type) {
    case Value::Null: return "null";
    case Value::Bool: return v.b ? "true" : "false";
    case Value::Num: {
      char buf[64];
      snprintf(buf, sizeof buf, "%.17g", v.n);
      return buf;
    }
    case Value::Str: return esc(v.s);
    case Value::Arr: {
      std::string out = "[";
      for (size_t k = 0; k < v.a.size(); k++) {
        if (k) out += ",";
        out += dump(v.a[k]);
      }
      return out + "]";
    }
    case Value::Obj: {
      std::string out = "{";
      bool first = true;
      for (const auto& kv : v.o) {
        if (!first) out += ",";
        first = false;
        out += esc(kv.first) + ":" + dump(kv.second);
      }
      return out + "}";
    }
  }
  return "null";
}

} // namespace jx
