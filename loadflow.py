import numpy as np
from numpy import cos, sin, pi, abs, angle, conj, real, imag

def lfybus(linedata):
    """Forms the bus admittance matrix"""
    nl = linedata[:, 0].astype(int)  # from bus
    nr = linedata[:, 1].astype(int)  # to bus
    R = linedata[:, 2]  # resistance
    X = linedata[:, 3]  # reactance
    Bc = 1j * linedata[:, 4]  # line charging susceptance
    a = linedata[:, 5]  # tap ratio
    
    nbr = len(linedata)
    nbus = max(max(nl), max(nr))
    
    Z = R + 1j * X
    y = 1.0 / Z
    
    Ybus = np.zeros((nbus, nbus), dtype=complex)
    
    # Off-diagonal elements
    for k in range(nbr):
        if a[k] <= 0:
            a[k] = 1
        Ybus[nl[k]-1, nr[k]-1] += -y[k]/a[k]
        Ybus[nr[k]-1, nl[k]-1] = Ybus[nl[k]-1, nr[k]-1]
    
    # Diagonal elements
    for n in range(nbus):
        for k in range(nbr):
            if nl[k] == n+1:
                Ybus[n, n] += y[k]/(a[k]**2) + Bc[k]/2
            elif nr[k] == n+1:
                Ybus[n, n] += y[k] + Bc[k]/2
                
    return Ybus

def lfnewton(busdata, Ybus, basemva, accuracy=1e-5, maxiter=100):
    """Newton-Raphson power flow solution"""
    nbus = len(busdata)
    bus_type = busdata[:, 1]
    Vm = busdata[:, 2]
    Va = np.radians(busdata[:, 3])
    Pd = busdata[:, 4]
    Qd = busdata[:, 5]
    Pg = busdata[:, 6]
    Qg = busdata[:, 7]
    Qmin = busdata[:, 8]
    Qmax = busdata[:, 9]
    Qsh = busdata[:, 10]
    
    V = Vm * (cos(Va) + 1j * sin(Va))
    P = (Pg - Pd)/basemva
    Q = (Qg - Qd + Qsh)/basemva
    
    # Count bus types
    ns = sum(bus_type == 1)  # swing buses
    ng = sum(bus_type == 2)  # PV buses
    pq = sum(bus_type == 0)  # PQ buses
    
    Ym = abs(Ybus)
    theta = angle(Ybus)
    
    maxerror = 1
    iter_count = 0
    converge = 1
    
    while maxerror >= accuracy and iter_count <= maxiter:
        iter_count += 1
        Pcal = np.zeros(nbus)
        Qcal = np.zeros(nbus)
        
        # Calculate P and Q
        for i in range(nbus):
            for k in range(nbus):
                Pcal[i] += Vm[i]*Vm[k]*Ym[i,k]*cos(theta[i,k] - Va[i] + Va[k])
                Qcal[i] += -Vm[i]*Vm[k]*Ym[i,k]*sin(theta[i,k] - Va[i] + Va[k])
        
        # Calculate mismatches
        dP = P - Pcal
        dQ = Q - Qcal
        
        # Build Jacobian matrix
        J1 = np.zeros((nbus, nbus))
        J2 = np.zeros((nbus, nbus))
        J3 = np.zeros((nbus, nbus))
        J4 = np.zeros((nbus, nbus))
        
        for i in range(nbus):
            for k in range(nbus):
                if i == k:
                    J1[i,k] = Vm[i]*Vm[k]*Ym[i,k]*sin(theta[i,k] - Va[i] + Va[k])
                    J2[i,k] = 2*Vm[i]*Ym[i,i]*cos(theta[i,i]) + sum(
                        Vm[m]*Ym[i,m]*cos(theta[i,m] - Va[i] + Va[m]) for m in range(nbus) if m != i)
                    J3[i,k] = Vm[i]*Vm[k]*Ym[i,k]*cos(theta[i,k] - Va[i] + Va[k])
                    J4[i,k] = -2*Vm[i]*Ym[i,i]*sin(theta[i,i]) - sum(
                        Vm[m]*Ym[i,m]*sin(theta[i,m] - Va[i] + Va[m]) for m in range(nbus) if m != i)
                else:
                    J1[i,k] = -Vm[i]*Vm[k]*Ym[i,k]*sin(theta[i,k] - Va[i] + Va[k])
                    J2[i,k] = Vm[i]*Ym[i,k]*cos(theta[i,k] - Va[i] + Va[k])
                    J3[i,k] = Vm[i]*Vm[k]*Ym[i,k]*cos(theta[i,k] - Va[i] + Va[k])
                    J4[i,k] = Vm[i]*Ym[i,k]*sin(theta[i,k] - Va[i] + Va[k])
        
        # Form reduced Jacobian for PQ and PV buses
        J = np.vstack([
            np.hstack([J1[1:, 1:], J2[1:, (bus_type == 0)]]),
            np.hstack([J3[bus_type == 0, 1:], J4[bus_type == 0][:, bus_type == 0]])
        ])
        
        # Solve for corrections
        dPQ = np.concatenate([dP[1:], dQ[bus_type == 0]])
        dX = np.linalg.solve(J, dPQ)
        
        # Update voltages
        dVa = np.zeros(nbus)
        dVa[1:] = dX[:nbus-1]
        
        dVm = np.zeros(nbus)
        dVm[bus_type == 0] = dX[nbus-1:]
        
        Va += dVa
        Vm += dVm
        V = Vm * (cos(Va) + 1j * sin(Va))
        
        maxerror = max(abs(np.concatenate([dP, dQ])))
    
    if iter_count > maxiter:
        print(f"Warning: Did not converge in {maxiter} iterations")
        converge = 0
    
    return V, converge, iter_count

def lineflow(linedata, V, basemva, P, Q, S):
    """Calculates line flows and losses"""
    nl = linedata[:, 0].astype(int)
    nr = linedata[:, 1].astype(int)
    R = linedata[:, 2]
    X = linedata[:, 3]
    Bc = 1j * linedata[:, 4]
    a = linedata[:, 5]
    
    nbr = len(linedata)
    nbus = len(V)
    
    Z = R + 1j * X
    y = 1.0 / Z
    
    SLT = 0 + 0j
    
    print("\nLine Flow and Losses\n")
    print("From To   P (MW)   Q (Mvar)   S (MVA)   Loss P   Loss Q   Tap")
    
    for n in range(nbus):
        busprt = False
        for L in range(nbr):
            if nl[L] == n+1:
                k = nr[L] - 1
                In = (V[n] - a[L]*V[k]) * y[L]/(a[L]**2) + Bc[L]/(a[L]**2)*V[n]
                Ik = (V[k] - V[n]/a[L]) * y[L] + Bc[L]*V[k]
                Snk = V[n] * conj(In) * basemva
                Skn = V[k] * conj(Ik) * basemva
                SL = Snk + Skn
                SLT += SL
                
                if not busprt:
                    print(f"\nBus {n+1}: P={P[n]*basemva:.3f} MW, Q={Q[n]*basemva:.3f} Mvar, S={abs(S[n])*basemva:.3f} MVA")
                    busprt = True
                
                print(f"{n+1:4d} {k+1:2d} {real(Snk):9.3f} {imag(Snk):9.3f} {abs(Snk):9.3f} {real(SL):9.3f} {imag(SL):9.3f}", end='')
                if a[L] != 1:
                    print(f" {a[L]:7.3f}")
                else:
                    print()
            
            elif nr[L] == n+1:
                k = nl[L] - 1
                In = (V[n] - V[k]/a[L]) * y[L] + Bc[L]*V[n]
                Ik = (V[k] - a[L]*V[n]) * y[L]/(a[L]**2) + Bc[L]/(a[L]**2)*V[k]
                Snk = V[n] * conj(In) * basemva
                Skn = V[k] * conj(Ik) * basemva
                SL = Snk + Skn
                SLT += SL
                
                if not busprt:
                    print(f"\nBus {n+1}: P={P[n]*basemva:.3f} MW, Q={Q[n]*basemva:.3f} Mvar, S={abs(S[n])*basemva:.3f} MVA")
                    busprt = True
                
                print(f"{n+1:4d} {k+1:2d} {real(Snk):9.3f} {imag(Snk):9.3f} {abs(Snk):9.3f} {real(SL):9.3f} {imag(SL):9.3f}", end='')
                if a[L] != 1:
                    print(f" {a[L]:7.3f}")
                else:
                    print()
    
    SLT = SLT / 2
    print(f"\nTotal losses: P={real(SLT):.3f} MW, Q={imag(SLT):.3f} Mvar")
    return SLT

# # Main power flow analysis
# if __name__ == "__main__":
#     # System data
#     basemva = 100
#     accuracy = 1e-5
#     maxiter = 100
    
#     # Bus data: [Bus No, Type, Vm, Va, Pd, Qd, Pg, Qg, Qmin, Qmax, Qsh]
#     busdata = np.array([
#         [1, 1, 1.03, 0, 0, 0, 300, 250, 0, 0, 0],
#         [2, 0, 1.00, 0, 256, 110, 0, 0, 0, 0, 0],
#         [3, 2, 1.03, 0, 0, 0, 110, 0, 0, 0, 0]
#     ])
    
#     # Line data: [From, To, R, X, B, Tap]
#     linedata = np.array([
#         [1, 2, 0.02, 0.035, 0, 1],
#         [1, 3, 0.02, 0.025, 0, 1],
#         [3, 2, 0.0125, 0.025, 0, 1]
#     ])
    
#     # Run power flow
#     Ybus = lfybus(linedata)
#     V, converge, iter_count = lfnewton(busdata, Ybus, basemva, accuracy, maxiter)
    
#     # Calculate power injections
#     nbus = len(busdata)
#     bus_type = busdata[:, 1]
#     Vm = abs(V)
#     Va = angle(V)
#     Pd = busdata[:, 4]
#     Qd = busdata[:, 5]
#     Pg = busdata[:, 6]
#     Qg = busdata[:, 7]
#     Qsh = busdata[:, 10]
    
#     P = (Pg - Pd)/basemva
#     Q = (Qg - Qd + Qsh)/basemva
#     S = P + 1j*Q
    
#     # Calculate line flows
#     SLT = lineflow(linedata, V, basemva, P, Q, S)
    
#     # Display bus voltages
#     print("\nBus Voltages:")
#     print("Bus   V (pu)   Angle (deg)")
#     for i in range(nbus):
#         print(f"{i+1:3d}   {abs(V[i]):.4f}    {angle(V[i])*180/pi:8.3f}")
    
#     # Display total losses
#     print(f"\nTotal system losses: {real(SLT):.3f} MW + j{imag(SLT):.3f} Mvar")