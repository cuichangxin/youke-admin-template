import auth from '@/plugins/auth'
import router, { constantRoutes, dynamicRoutes } from '@/router'
import api from '@/api/api'
import Layout from '@/layout/index'
import ParentView from '@/components/common/ParentView'
import InnerLink from '@/layout/components/InnerLink'
import axios from 'axios'
import { cloneDeep } from 'lodash'

// 匹配views里面所有的.vue文件
const modules = import.meta.glob('./../../page/**/*.vue')

const usePermissionStore = defineStore(
  'permission',
  {
    state: () => ({
      routes: [],
      addRoutes: [],
      defaultRoutes: [],
      topbarRouters: [],
      sidebarRouters: []
    }),
    actions: {
      setRoutes(routes) {
        this.addRoutes = routes
        this.routes = constantRoutes.concat(routes).filter(item => !item.hidden)
      },
      setDefaultRoutes(routes) {
        this.defaultRoutes = constantRoutes.concat(routes)
      },
      setTopbarRoutes(routes) {
        this.topbarRouters = routes.filter(item => !item.hidden)
      },
      setSidebarRouters(routes) {
        this.sidebarRouters = routes.filter(item => !item.hidden)
      },
      generateRoutes(roles) {
        return new Promise(resolve => {
          // 向后端请求路由数据
          // TODO: 临时
          // api.getRouters().then(res => {
          axios.get('/list').then(res => {
            // const sdata = JSON.parse(JSON.stringify(res.data))
            // const rdata = JSON.parse(JSON.stringify(res.data))
            // const defaultData = JSON.parse(JSON.stringify(res.data))

            const sdata = cloneDeep(res.data.data)
            const rdata = cloneDeep(res.data.data)
            const defaultData = cloneDeep(res.data.data)
            const sidebarRoutes = filterAsyncRouter(sdata)
            const rewriteRoutes = filterAsyncRouter(rdata, false, true)
            const defaultRoutes = filterAsyncRouter(defaultData)
            const asyncRoutes = filterDynamicRoutes(dynamicRoutes)
            asyncRoutes.forEach(route => { router.addRoute(route) })
            this.setRoutes(rewriteRoutes)
            this.setSidebarRouters(constantRoutes.concat(sidebarRoutes))
            this.setDefaultRoutes(defaultRoutes)
            this.setTopbarRoutes(constantRoutes.concat(defaultRoutes))
            resolve(rewriteRoutes)
          })
        })
      },
      async updateRouteList(layoutModel, router) {
        if (layoutModel === '1') {
          let list = cloneDeep(this.topbarRouters)
          this.topbarRouters = list.map(item => {
            if (item.path === '/') {
              return item.children[0]
            }
            if (item.children && item.children.length === 1 && !item.alwaysShow) {
              return item.children[0]
            } else {
              delete item.children
            }
            return item
          })
          if (router.matched[0].children.length > 1) {
            let list = cloneDeep(this.routes)
            this.sidebarRouters = list.map(item=>{
              if (item.path === router.matched[0].path) {
                return item.children
              }
            }).filter(Boolean)[0]
          }
        } else if (layoutModel === '3' || layoutModel === '4') {
          this.sidebarRouters = cloneDeep(this.routes)
        } else {
          this.topbarRouters = cloneDeep(this.routes)
          this.sidebarRouters = []
        }
      }
    }
  })

// 遍历后台传来的路由字符串，转换为组件对象
function filterAsyncRouter(asyncRouterMap, lastRouter = false, type = false) {
  return asyncRouterMap.filter(route => {
    if (type && route.children) {
      route.children = filterChildren(route.children)
    }
    if (route.component) {
      // Layout ParentView 组件特殊处理
      if (route.component === 'Layout') {
        route.component = Layout
      } else if (route.component === 'ParentView') {
        route.component = ParentView
      } else if (route.component === 'InnerLink') {
        route.component = InnerLink
      } else {
        route.component = loadView(route.component)
      }
    }
    if (route.children != null && route.children && route.children.length) {
      route.children = filterAsyncRouter(route.children, route, type)
    } else {
      delete route['children']
      delete route['redirect']
    }
    return true
  })
}

function filterChildren(childrenMap, lastRouter = false) {
  var children = []
  childrenMap.forEach((el, index) => {
    if (el.children && el.children.length) {
      if (el.component === 'ParentView' && !lastRouter) {
        el.children.forEach(c => {
          c.path = el.path + '/' + c.path
          if (c.children && c.children.length) {
            children = children.concat(filterChildren(c.children, c))
            return
          }
          children.push(c)
        })
        return
      }
    }
    if (lastRouter) {
      el.path = lastRouter.path + '/' + el.path
      if (el.children && el.children.length) {
        children = children.concat(filterChildren(el.children, el))
        return
      }
    }
    children = children.concat(el)
  })
  return children
}

// 动态路由遍历，验证是否具备权限
export function filterDynamicRoutes(routes) {
  const res = []
  routes.forEach(route => {
    if (route.permissions) {
      if (auth.hasPermiOr(route.permissions)) {
        res.push(route)
      }
    } else if (route.roles) {
      if (auth.hasRoleOr(route.roles)) {
        res.push(route)
      }
    }
  })
  return res
}

export const loadView = (view) => {
  let res;
  for (const path in modules) {
    const dir = path.split('page/')[1].split('.vue')[0];
    if (dir === view) {
      res = () => modules[path]();
    }
  }
  return res;
}

export default usePermissionStore
